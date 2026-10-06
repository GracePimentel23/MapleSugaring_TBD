"""Minimal serial port access with no required dependencies (copied from maplebackend/frontend).

Uses pyserial when it is installed. Otherwise, on Windows, talks to the COM
port directly through the Win32 API with ctypes, so the front end runs on a
stock Python install.
"""

import sys
import time

try:
    import serial as _pyserial          # optional
    import serial.tools.list_ports as _list_ports
except ImportError:                     # pragma: no cover - depends on machine
    _pyserial = None


def list_ports():
    """Return a list of (port, description) tuples."""
    if _pyserial:
        return [(p.device, p.description or "") for p in _list_ports.comports()]
    if sys.platform == "win32":
        import winreg
        out = []
        try:
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DEVICEMAP\SERIALCOMM")
        except OSError:
            return out
        i = 0
        while True:
            try:
                dev, port, _ = winreg.EnumValue(key, i)
            except OSError:
                break
            out.append((port, dev))
            i += 1
        return sorted(out)
    return []


def likely_board(desc):
    """True for USB-UART bridges used on LoRa32 boards (CP210x, CH340, USB CDC)."""
    d = desc.lower()
    return any(s in d for s in ("silab", "cp210", "usbser", "ch34", "usb", "uart"))


def open_port(port, baud=115200):
    if _pyserial:
        s = _pyserial.Serial()
        s.port, s.baudrate, s.timeout = port, baud, 0.2
        s.dtr = False        # don't reset / hold the ESP32 in the bootloader
        s.rts = False
        s.open()
        return _PySerialWrap(s)
    if sys.platform == "win32":
        return _Win32Serial(port, baud)
    raise RuntimeError("pyserial is required on this OS: python -m pip install pyserial")


class _LineReader:
    def __init__(self):
        self._buf = b""

    def readline(self):
        """Return one decoded line, or None if no full line arrived yet."""
        while b"\n" not in self._buf:
            chunk = self.read_chunk()
            if not chunk:
                return None
            self._buf += chunk
        line, self._buf = self._buf.split(b"\n", 1)
        return line.decode("utf-8", "replace").rstrip("\r")


class _PySerialWrap(_LineReader):
    def __init__(self, s):
        super().__init__()
        self.s = s

    def read_chunk(self):
        n = self.s.in_waiting or 1
        return self.s.read(n)

    def write(self, data):
        self.s.write(data)

    def close(self):
        self.s.close()


class _Win32Serial(_LineReader):
    def __init__(self, port, baud):
        super().__init__()
        import ctypes
        from ctypes import wintypes
        self.ct, self.wt = ctypes, wintypes
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        self.k32 = k32
        k32.CreateFileW.restype = wintypes.HANDLE
        GENERIC_RW = 0x80000000 | 0x40000000
        OPEN_EXISTING = 3
        h = k32.CreateFileW("\\\\.\\" + port, GENERIC_RW, 0, None, OPEN_EXISTING, 0, None)
        if h in (None, wintypes.HANDLE(-1).value):
            raise OSError("cannot open %s (in use by another program?) error %d"
                          % (port, ctypes.get_last_error()))
        self.h = h

        class DCB(ctypes.Structure):
            _fields_ = [("DCBlength", wintypes.DWORD), ("BaudRate", wintypes.DWORD),
                        ("fBits", wintypes.DWORD), ("wReserved", wintypes.WORD),
                        ("XonLim", wintypes.WORD), ("XoffLim", wintypes.WORD),
                        ("ByteSize", wintypes.BYTE), ("Parity", wintypes.BYTE),
                        ("StopBits", wintypes.BYTE), ("XonChar", ctypes.c_char),
                        ("XoffChar", ctypes.c_char), ("ErrorChar", ctypes.c_char),
                        ("EofChar", ctypes.c_char), ("EvtChar", ctypes.c_char),
                        ("wReserved1", wintypes.WORD)]

        class COMMTIMEOUTS(ctypes.Structure):
            _fields_ = [(n, wintypes.DWORD) for n in (
                "ReadIntervalTimeout", "ReadTotalTimeoutMultiplier", "ReadTotalTimeoutConstant",
                "WriteTotalTimeoutMultiplier", "WriteTotalTimeoutConstant")]

        dcb = DCB()
        dcb.DCBlength = ctypes.sizeof(DCB)
        k32.GetCommState(h, ctypes.byref(dcb))
        spec = "baud=%d parity=N data=8 stop=1 dtr=off rts=off" % baud
        if not k32.BuildCommDCBW(spec, ctypes.byref(dcb)) or not k32.SetCommState(h, ctypes.byref(dcb)):
            self.close()
            raise OSError("cannot configure %s, error %d" % (port, ctypes.get_last_error()))
        # Return as soon as any byte arrives, or after 200 ms with nothing.
        to = COMMTIMEOUTS(0xFFFFFFFF, 0xFFFFFFFF, 200, 0, 1000)
        k32.SetCommTimeouts(h, ctypes.byref(to))

    def read_chunk(self):
        buf = self.ct.create_string_buffer(4096)
        n = self.wt.DWORD(0)
        ok = self.k32.ReadFile(self.h, buf, 4096, self.ct.byref(n), None)
        if not ok:
            raise OSError("serial read failed, error %d (board unplugged?)" % self.ct.get_last_error())
        return buf.raw[:n.value]

    def write(self, data):
        n = self.wt.DWORD(0)
        self.k32.WriteFile(self.h, data, len(data), self.ct.byref(n), None)

    def close(self):
        if getattr(self, "h", None):
            self.k32.CloseHandle(self.h)
            self.h = None


def find_gateway(ports=None, listen_s=7.0, log=print):
    """Open each likely board port and return the first one that prints a
    gateway line ("role":"gateway"). The gateway prints status every 5 s."""
    candidates = ports or [p for p, d in list_ports() if likely_board(d)]
    for port in candidates:
        try:
            s = open_port(port)
        except OSError as e:
            log("  %s: %s" % (port, e))
            continue
        try:
            deadline = time.time() + listen_s
            while time.time() < deadline:
                line = s.readline()
                if line and '"role":"gateway"' in line:
                    log("  %s: gateway found" % port)
                    return port
                if line and '"role":"node"' in line or (line and "[TX" in line):
                    log("  %s: this is the load cell node, skipping" % port)
                    break
            else:
                log("  %s: no gateway output" % port)
        finally:
            s.close()
    return None
