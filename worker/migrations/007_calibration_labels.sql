-- What a calibration point was weighed with ("gallon of water", "25 lb plate"), so a household item
-- that throws the fit off can be found and removed.
alter table calibration_points add column if not exists label varchar(60);
