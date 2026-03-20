# SEN55 Documentation Index

Converted from Sensirion PDFs via `pdftotext -layout`. Regenerate with `./convert.sh`.

## Datasheet & Specifications

- **Sensirion_Datasheet_Environmental_Node_SEN5x.md** — Main datasheet: specs, I2C commands (addr 0x69), electrical/mechanical specs, pin assignments, communication protocol
- **PS_AN_Read_RHT_VOC_and_NOx_RAW_signals_v2_D1.md** — I2C command 0x03D2 for reading raw humidity, temperature, VOC, and NOx values with byte layout and scale factors
- **Sensirion_SEN5x_Read_Mass_and_Number_Concentrations.md** — I2C command for reading PM mass and number concentration values

## Engineering & Integration

- **Sensirion_Engineering_Guidelines_SEN5x.md** — Evaluation, electrical/mechanical integration, algorithm settings customization
- **Sensirion_Mechanical_Design_and_Assembly_Guidelines_SEN5x.md** — Physical design-in guidelines: airflow, mounting, inlet/outlet placement
- **Sensirion_Handling_Instructions_SEN5x.md** — Storage, assembly, and packaging precautions (VOC exposure, ESD, etc.)
- **Sensirion_Temperature_Acceleration_and_Compensation_Instructions_SEN.md** — STAR engine, temperature compensation for designed-in sensors, offset tuning

## Operating Modes

- **Reduced_Power_Operation_SEN5x.md** — Low-power mode alternating between full measurement and RHT/Gas-only mode (fan/laser off)

## VOC & NOx Sensing

- **Info_Note_VOC_Index.md** — VOC Index explanation: scale (100 = baseline), interpretation, adaptive algorithm
- **Info_Note_NOx_Index.md** — NOx Index explanation: scale (1 = baseline), interpretation
- **Info_Note_MOX_sensor.md** — How metal-oxide gas sensors work, capabilities and limitations of SGP4x
- **Info_Note_Output_MOX_Sensor.md** — Why MOX sensor output only maps to norms under lab conditions
- **Info_Note_Integration_VOC_NOx_Sensor.md** — Integrating VOC/NOx sensing into air purifiers: fan control, data visualization
- **GAS_AN_SGP4x_BuildingStandards_D1_1.md** — VOC sensor compliance with building air quality standards (WELL, LEED, ASHRAE)

## Gas Types

- **Info_Note_Reducing_Gases.md** — Reducing gases (VOCs, H2, ethanol, formaldehyde) — what SGP4x detects
- **Info_Note_Oxidizing_Gases.md** — Oxidizing gases (NOx, O3) — what SGP41 detects, sources, health risks

## Air Purifier Application

- **Info_Note_Make_Air_Purifier_Smart.md** — Using environmental sensors to make air purifiers demand-controlled and efficient
- **Info_Note_Improve_Air_Quality.md** — Overview of indoor air pollutants and how air purifiers with sensors address them
