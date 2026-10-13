alter table public.mhpi_quarterly drop constraint mhpi_quarterly_pkey;
alter table public.mhpi_quarterly add primary key (source_table, series, quarter);
