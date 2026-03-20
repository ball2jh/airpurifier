---
source: Sensirion_SEN5x_Read_Mass_and_Number_Concentrations.pdf
generated: 2026-03-20
note: Manually transcribed — source PDF is image-based (Print To PDF)
---

[0x0413] Read Measured PM Values

Returns the measured particulate matter values.

The command 0x0202 "Read Data Ready" can be used to check if new data is available since the last read operation. If
no new data is available, the previous values will be returned again. If no data is available at all (e.g. measurement not
running for at least one second), all values will be 0xFFFF.

Read Measured PM Values
  Command ID             0x0413
  Firmware Versions      Available in: >0.7
  Read Delay             20 ms
  Post Processing Time   0 ms
  Max. RX Data With CRC  30 Bytes
  TX Data                None

RX Data:

  Byte #   Type   Description
  0        MSB    Mass Concentration PM1.0: uint16
  1        LSB    Value is scaled with factor 10: PM1.0 [ug/m3] = value / 10
  2        CRC    Note: If this value is unknown, 0xFFFF is returned.
  3        MSB    Mass Concentration PM2.5: uint16
  4        LSB    Value is scaled with factor 10: PM2.5 [ug/m3] = value / 10
  5        CRC    Note: If this value is unknown, 0xFFFF is returned.
  6        MSB    Mass Concentration PM4.0: uint16
  7        LSB    Value is scaled with factor 10: PM4.0 [ug/m3] = value / 10
  8        CRC    Note: If this value is unknown, 0xFFFF is returned.
  9        MSB    Mass Concentration PM10.0: uint16
  10       LSB    Value is scaled with factor 10: PM10.0 [ug/m3] = value / 10
  11       CRC    Note: If this value is unknown, 0xFFFF is returned.
  12       MSB    Number Concentration PM0.5: uint16
  13       LSB    Value is scaled with factor 10: PM0.5 [#/cm3] = value / 10
  14       CRC    Note: If this value is unknown, 0xFFFF is returned.
  15       MSB    Number Concentration PM1.0: uint16
  16       LSB    Value is scaled with factor 10: PM1.0 [#/cm3] = value / 10
  17       CRC    Note: If this value is unknown, 0xFFFF is returned.
  18       MSB    Number Concentration PM2.5: uint16
  19       LSB    Value is scaled with factor 10: PM2.5 [#/cm3] = value / 10
  20       CRC    Note: If this value is unknown, 0xFFFF is returned.
  21       MSB    Number Concentration PM4.0: uint16
  22       LSB    Value is scaled with factor 10: PM4.0 [#/cm3] = value / 10
  23       CRC    Note: If this value is unknown, 0xFFFF is returned.
  24       MSB    Number Concentration PM10.0: uint16
  25       LSB    Value is scaled with factor 10: PM10.0 [#/cm3] = value / 10
  26       CRC    Note: If this value is unknown, 0xFFFF is returned.
  27       MSB    Typical Particle Size: uint16
  28       LSB    Value is scaled with factor 1000: Size [um] = value / 1000
  29       CRC    Note: If this value is unknown, 0xFFFF is returned.
