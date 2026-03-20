---
source: PS_AN_Read_RHT_VOC_and_NOx_RAW_signals_v2_D1.pdf
generated: 2026-03-20
---

     Read Measured Raw Values (0x03D2)

Returns the measured raw values.
The command 0x0202 "Read Data Ready" can be used to check if new data is available since the last read
operation. If no new data is available, the previous values will be returned again. If no data is available at all (e.g.
measurement not running for at least one second), all values will be at their upper limit (0xFFFF for uint16,
0x7FFF for int16). No specifications are provided, at module level, for the RAW outputs.
Command           Returned data
0x03D2            Raw Humidity, Raw Temperature, RAW VOC, RAW NOx

Read Data:

      Byte #      Datatype                    Scale factor   Description
       0..1       big-endian, int16           100            RAW Humidity
                                                             RH [%] = value / 100
        2         Checksum for bytes 0, 1
       3..4       big-endian, int16           200            RAW Temperature
                                                             T [°C] = value / 200
        5         Checksum for bytes 3, 4
       6..7       big-endian, uint16          1              RAW VOC
        8         Checksum for bytes 6, 7
      9..10       big-endian, uint16          1              RAW NOx
                                                             During the ﬁrst 10..11 seconds after power-on or device
                                                             reset, this value will be 0xFFFF as well.
       11         Checksum for bytes 9, 10
© Copyright Sensirion AG, Switzerland          1/1

