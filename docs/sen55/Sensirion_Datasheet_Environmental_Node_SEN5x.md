---
source: Sensirion_Datasheet_Environmental_Node_SEN5x.pdf
generated: 2026-03-20
---

Datasheet SEN5x
Environmental Sensor Node for HVAC and Air Quality Applications

▪   PM, NOx, VOC, RH & T sensor platform
▪   Fast & easy integration
▪   One driver for up to 8 data signals
▪   Superior sensing accuracy and lifetime
▪   Fully calibrated digital output
    Overview
    The SEN5x is a unique sensor module family combining the measurement of critical air quality parameters –
    particulate matter, VOC, NOx, humidity, and temperature – in a single package. The modules are a result of
    Sensirion’s extensive experience in environmental sensing and offers best possible performance of each
    sensing parameter, a superior lifetime, as well as a compact form factor. The SEN5x sensors provide fully
    calibrated outputs with a digital interface. The combination of all measurement parameters in a single device
    allows manufacturers of air quality devices to reduce design and integration efforts, shorten development times
    and simplify their supply chain. Proprietary algorithms enable straightforward integration into HVAC and air
    quality applications allowing resource/time savings and focus on core competencies. The implemented
    Sensirion Temperature Acceleration Routine (STAR) engine accelerates the device’s response to ambient
    temperature change by a factor of 2-3 to provide better UX and more accurate measurements to end users.
www.sensirion.com                              Version 2 – D1 – March 2022                                            1/30
                     Air
                    Flow
                      RH & T
                                                               I2C
                    VOC & NOx
                                                                       3V3     Power    5V
                               Laser                                                                      VDD
                                                                               Supply
                                          Laser
                                        Controller                                                        SDA
                                                                                                ESD
                                                            MCU
                                                                                             Protection
                                        Amplifier &                                                       SCL
                                          Filter
                               Photo-
                               diode                                                                      GND
                                          Fan
                       Fan
                                        Controller

Figure 1 Functional block diagram of the SEN5x. The RH & T and VOC sensors are only contained in the SEN54 and SEN55, the
NOx signal is only contained in the SEN55.
www.sensirion.com                                     Version 2 – D1 – March 2022                                    2/30
Content
1 Product Family Overview and Ordering Information                         4
2 Environmental Sensor Node Specifications                                  5
3 Electrical Specifications                                                11
4 Hardware Interface Specifications                                        13
5 Functional Overview                                                      14
6 Operation and Communication through the I2C Interface                    17
7 Technical Drawings                                                       26
8 Revision History                                                         28
9 Important Notices                                                        29
www.sensirion.com                            Version 2 – D1 – March 2022        3/30
1 Product Family Overview and Ordering Information

The SEN5x product family consists of a lineup of sensors with identical dimensions, identical hardware & firmware
interface, and varying number of sensor outputs. Table 1 gives an overview of all available product variants with their
respective sensor outputs.
Specifications and commands for sensor inputs/outputs only apply for the given product if the sensor output is part of
this product.
Products              Sensor outputs             Description                                    Article Number
SEN50-SDN-T           Particulate Matter                                                        3.000.667
                                                 Particulate matter sensor, tray packaging,
                                                 45 pcs. per tray
SEN54-SDN-T           Particulate Matter         Environmental sensor node, tray packaging,     3.000.535
                      Relative Humidity          45 pcs. per tray
                      Temperature
                      VOC Index

SEN55-SDN-T           Particulate Matter         Environmental sensor node, tray packaging,     3.000.593
                      Relative Humidity          45 pcs. per tray
                      Temperature
                      VOC Index
                      NOx Index
Table 1: Sensor module specifications.
www.sensirion.com                              Version 2 – D1 – March 2022                                         4/30
2 Environmental Sensor Node Specifications

Default conditions of standard Measurement-Mode (6.1.1), 25 °C and 5 V supply voltage apply to values in the table
below, unless otherwise stated.

         2.1 Sensor Module Specifications
 Parameter                                               Conditions                                  Value                         Units
 Sampling interval                                       -                                           1  0.03                      s
 Lifetime1                                               24 h/day operation                          > 10                          years
 Acoustic emission level                                 0.2 m                                       24                            dB(A)
 Long term acoustic emission level drift                 0.2 m                                       +0.5                          dB(A) / year
 Weight                                                  -                                           36.4  10%                    g

Table 2: Sensor module specifications.
1 Lifetime is based on mean-time-to-failure (MTTF) calculation. Lifetime might vary depending on different operating conditions.
www.sensirion.com                                                Version 2 – D1 – March 2022                                                      5/30
          2.2 Particulate Matter Specifications
 Parameter                                                              Conditions                                               Value             Units
 Mass concentration specified range                                     -                                                        0 to 1’000        μg/m3
 Mass concentration size range                                          PM1.0                                                    0.3 to 1.0        μm
                                                                        PM2.5                                                    0.3 to 2.5        μm
                                                                        PM4                                                      0.3 to 4.0        μm
                                                                        PM10                                                     0.3 to 10.0       μm
 Mass concentration precision2,3 for PM1 and PM2.54                     0 to 100 μg/m3                                           5 μg/m3 AND 5 % m.v.
                                                                        100 to 1000 μg/m3                                        10         % m.v.
 Mass concentration precision2,3 for PM4, PM105                         0 to 100 μg/m3                                           25               μg/m3
                                                                        100 to 1000 μg/m3                                        25               % m.v.
 Maximum long-term mass concentration precision                         0 to 100 μg/m3                                           1.25             μg/m3 / year
 limit drift                                                            100 to 1000 μg/m3                                        1.25         % m.v. / year
 Typical start-up time6                                                 number              200 – 3000 #/cm3                     8             s
                                                                        concentration       100 – 200 #/cm3                      16            s
                                                                                            50 – 100 #/cm3                       30            s
 Sensor output characteristics                                          PM2.5 mass concentration                                 Calibrated to TSI DustTrak™
                                                                                                                                 DRX 8533 Ambient Mode
 Additional T-dependent mass precision limit drift3                     temperature                 typ.                         0.5          % m.v. / °C
                                                                        difference to 25°C
 Laser wavelength                                                       typ.                                                     660               nm
 (DIN EN 60825-1 Class 1)

Table 3: Particulate matter sensor specifications. Default conditions of 252 °C, 5010% relative humidity and 5 V supply voltage
apply unless otherwise stated. ‘max.’ means ‘maximum’, ‘typ.’ means ‘typical’, ‘% m.v.’ means ‘% of measured value’.
2 Also referred to as “between-parts variation” or “device-to-device variation”.
3 For further details, please refer to the document “Sensirion Particulate Matter Sensor Specification Statement”.
4 Verification Aerosol for PM2.5 is a 3% atomized KCl solution. Deviation to reference instrument is verified in end-tests for every sensor after calibration.
5 PM4 and PM10 output values are calculated based on distribution profile of all measured particles.
6 Time after starting Measurement-Mode, until a stable measurement is obtained.
www.sensirion.com                                                  Version 2 – D1 – March 2022                                                                    6/30
         2.3 Temperature and Humidity Specifications
 Parameter                                     Conditions                                            Value 7                            Units
 Compensated outputs8                          -                                                     Temperature and                    °C
                                                                                                     Relative Humidity                  %RH
 Typical accuracy temperature                  @ 15-30 °C, 50 %RH                                    0.45                              °C
 Max. accuracy temperature                     @ 15-30 °C, 50 %RH                                    ±0.7                               °C
 Repeatability temperature                     @ 25 °C, 50 %RH                                       0.1                                °C
 Response time temperature9                    @ 25 °C, 50 %RH,  63%                                < 60                               s

 Typical accuracy relative humidity            @ 25 °C, 30-70 %RH                                    4.5                               %RH
 Max. accuracy relative humidity               @ 25 °C, 30-70 %RH                                    ±6                                 %RH
 Repeatability relative humidity               @ 25 °C, 50 %RH                                       1                                 %RH
 Response time relative humidity 10            @ 25 °C, 50 %RH,  63%                                < 20                               s

Table 4: Temperature and humidity specifications.
7 For the definition of the typical and max. accuracy tolerance, please refer to the document “Sensirion Humidity Sensor Specification Statement”.
8 Self-heating of the module is compensated according to the application note “Temperature Acceleration and Compensation Instructions for SEN5x”.
9 For a step from 15°C to 25°C

10 For a step from 75%RH to 25%RH
www.sensirion.com                                                Version 2 – D1 – March 2022                                                         7/30
         2.4 Gas Specifications
                                                                                Values
 Parameter                    Comments                                          Min.             Typ.11          Max.         Units
 Output signals               VOC Index                                         1                –               500          VOC Index points
                              NOx Index                                         1                –               500          NOx Index points
 Device-to-device             VOC Index12                                       –                <±15            –            VOC Index points
 variation                                                                                                                    or
                                                                                                 <±15                         % VOC Index m.v.
                                                                                                                              (the larger)
                              NOx Index12                                       –                <±50            –            NOx Index points
                                                                                                                              or
                                                                                                 <±50                         % NOx Index m.v.
                                                                                                                              (the larger)
 Repeatability                VOC Index12                                       –                <±5             –            VOC Index points
                                                                                                                              or
                                                                                                 <±5                          % VOC Index m.v.
                                                                                                                              (the larger)
                              NOx Index12                                      –                 <±10            –            NOx Index points
                                                                                                                              or
                                                                                                 <±10                         % NOx Index m.v.
                                                                                                                              (the larger)
 Response time                Changing concentration             63            –                <10             –            s
                              from 5 to 10 ppm of ethanol, at                  –                <30             –            s
                                                                  90
                              sampling interval of 1 s
 Switch-on behavior           Time until reliably detecting events13            –                <60             –            s
                              Time until specifications in this table           VOC Index <1                     –            h
                              are met                                           NOx Index <6                     –            h

Table 5: Gas sensing specifications at 25 °C and 50 % RH in zero air (considered as clean air for indoor air quality applications). All
concentrations refer to ethanol as test gas.
11 95 % of the sensors will be within the typical tolerance corresponding to 2σ assuming a normal distribution for ≥100 sensors.
12 Evaluated using the calibration and test sequence according to the application note SGP40 – Testing Guide.
13 Signal change during 60-s event of 5000 to 10000 ppb of ethanol or of 100 to 300 ppb of NO
                                                                                                2 is three times larger than raw signals drift, without this event during
  the same duration.

www.sensirion.com                                                Version 2 – D1 – March 2022                                                                        8/30
                 2.5 Recommended and Absolute Maximum/Minimum Operating and Storage Conditions
The SEN5x contains different sensing components with different recommended operating and storage ranges. To ensure
an optimal performance of the SEN5x, the “SEN5x Handling Instructions” as well as the “SEN5x Mechanical Assembly
and Design-in Guidelines” need to be followed.
                 2.5.1 SEN54 and SEN55
Table 6 and Figure 2 show the recommended operating and storage conditions in which all the sensing components of
the SEN54 and SEN55 show best performance, as well as absolute maximum/minimum conditions which must not be
exceeded. Gas sensing specifications are guaranteed only when the SEN54 and SEN55 are operated and stored under
the recommended conditions given in Table 6.

Exposure to conditions outside the recommended range may temporarily reduce sensor performance (reversible RH
drift, reduced RH, T, gas, PM accuracy). Exposure to conditions outside absolute maximum/minimum range may lead
to permanently reduced sensor performance (gas sensitivity drift) or cause permanent damage to the device.

The sensor must not be exposed towards condensing conditions at any time.
                                                                        Recommended                                        Absolute Maximum/Minimum              Unit
 Condition                                   Parameter
                                                                        Min.          Max.                                 Min.         Max.
Operating conditions                         Temperature                10            40                                   -10          50                       °C
                                             Relative humidity          20            80                                   0            90 (non-condensing) % RH
Storage conditions                           Temperature                10            30                                   -40          70                       °C
                                             Relative Humidity          20            60                                   0            80 (non-condensing) % RH

Table 6 Recommended and absolute maximum/minimum operating and storage conditions for SEN54 and SEN55.
                                                 Operating                                                                                     Storage
                           100                                                                                     100
                           80                                                                                       80
   Relative humidity / %                                                                   Relative humidity / %
                           60                                                                                       60
                           40                                                                                       40
                           20                                                                                       20
                             0                                                                                      0
                                 -40   -20   0       20         40      60       80                                      -40      -20   0        20         40    60    80
                                             Temperature / °C                                                                            Temperature / °C
                                                                Recommended range                                  Absolute maximum/minimum range
Figure 2 Recommended and absolute maximum/minimum operating and storage conditions for SEN54 and SEN55.
www.sensirion.com                                                        Version 2 – D1 – March 2022                                                                         9/30
                 2.5.2 SEN50
Table 7 and Figure 3 show the recommended operating and storage conditions in which all the sensing components of
the SEN50 shows the best performance, as well as absolute maximum/minimum conditions which must not be exceeded.

Exposure to conditions outside the recommended range may temporarily reduce sensor performance (PM accuracy).
Exposure to conditions outside absolute maximum/minimum range may lead to permanently reduced sensor
performance (gas sensitivity drift) or cause permanent damage to the device.

The sensor must not be exposed towards condensing conditions at any time.
                                                                        Recommended                                          Absolute Maximum/Minimum              Unit
 Condition                                   Parameter
                                                                        Min.          Max.                                   Min.         Max.
Operating conditions                         Temperature                10            40                                     -10          60                       °C
                                             Relative humidity          20            80                                     0            95 (non-condensing) % RH
Storage conditions                           Temperature                10            30                                     -40          70                       °C
                                             Relative Humidity          20            60                                     0            95 (non-condensing) % RH

Table 7 Recommended and absolute maximum/minimum operating and storage conditions for SEN50.
                                                 Operating                                                                                       Storage
                           100                                                                                       100
                           80                                                                                        80
   Relative humidity / %                                                                     Relative humidity / %
                           60                                                                                        60
                           40                                                                                        40
                           20                                                                                        20
                            0                                                                                          0
                                 -40   -20   0       20         40      60       80                                        -40      -20   0        20         40    60    80
                                             Temperature / °C                                                                              Temperature / °C
                                                                Recommended range                                    Absolute maximum/minimum range
Figure 3 Recommended and absolute maximum/minimum operating and storage conditions for SEN50.
www.sensirion.com                                                        Version 2 – D1 – March 2022                                                                       10/30
3 Electrical Specifications

        3.1 Electrical Characteristics
Parameter                          Conditions                                        Min          Typ       Max       Unit
Supply voltage                     -                                                 4.5          5.0       5.5        V
Sensor startup time (Time after    -
power-on until I2C                                                                    -            -         50       ms
communication can be started)
                                   Idle Mode (first 10 seconds)              SEN55     -          3.8        4.2
                                                                             SEN54     -          0.7         1
                                                                             SEN50     -          0.7         1
                                   Idle Mode (after first 10 seconds)        SEN55     -          2.6         3
                                                                             SEN54     -          0.7         1
                                                                             SEN50     -          0.7         1
                                   RHT/Gas-only Measurement Mode             SEN55     -          6.8         8
Average supply current                                                                                                mA
                                                                             SEN54     -          6.5       7.7
                                   Measurement-Mode (first 60 seconds)       SEN55     -           70       100
                                                                             SEN54     -           70       100
                                                                             SEN50     -           70       100
                                   Measurement-Mode (after first 60          SEN55     -           63        80
                                   seconds)                                  SEN54     -           63        80
                                                                             SEN50     -           63        80
Peak supply current                Measurement mode (pulse width of 16µs)              -          100       110       mA
Input high level voltage (VIH)     -                                                 2.31           -        5.5
Input low level voltage (VIL)      -                                                   0            -       0.99       V
Output low level voltage (VOL)     Sink current <6mA                                   0            0        0.4
Table 8 Electrical specifications at 25°C.

        3.2 Absolute Maximum Ratings
Stress levels beyond those listed in Table 9 may cause permanent damage to the device. These are stress ratings only
and functional operation of the device at these conditions cannot be guaranteed. Exposure to the absolute maximum
rating conditions for extended periods may affect the reliability of the device.
Parameter                                                                                  Min             Max         Unit
Supply voltage VDD                                                                         -0.3             5.5
Interface Select SEL                                                                       -0.3             5.5         V
I/O pins (RX/SDA, TX/SCL)                                                                  -0.3             5.5
Max. current on any I/O pin                                                                -16              16         mA
Operating temperature range                                                                             see Table 6
Operating humidity range                                                                                see Table 6
Storage temperature range (short-term, e.g. transport)                                                  see Table 6
Storage humidity range (short-term, e.g. transport)                                                     see Table 6
Table 9: Absolute minimum and maximum ratings.
www.sensirion.com                                   Version 2 – D1 – March 2022                                              11/30
       3.3 ESD / EMC Ratings
Immunity
Description                                    Standard               Rating
Electro Static Discharge                       IEC 61000-4-2          ±4 kV contact, ±8 kV air
Power-Frequency Magnetic Field                 IEC 61000-4-8          30A/m, 50Hz and 60Hz
Radio-Frequency EM-Field AM-modulated          IEC 61000-4-3          80MHz - 1000MHz, 3V/m, 80% AM @1kHz
Radio-Frequency EM-Field AM-modulated          IEC 61000-4-3          1.4GHz – 6GHz, 3V/m, 80% AM @1kHz
Emission
Description                                    Standard               Rating
Emission in SAC for 30MHz to 230MHz            IEC/CISPR 16           40dB(µV/m) QP @3m
Emission in SAC for 230MHz to 1000MHz          IEC/CISPR 16           47dB(µV/m) QP @3m
www.sensirion.com                       Version 2 – D1 – March 2022                                     12/30
4 Hardware Interface Specifications

The sensor is equipped with a serial communication interface. The interface connector is located at the side of the sensor
adjacent to the air outlet. The used connector is ACES 51451-0060N-001 on the sensor’s side, while the corresponding
plug is ACES 51452-006H0H0-001. At the time of writing JST GHR-06V-S is compatible and can be used as well. In
Table 11, a description of the pin layout is given.

 Part          Connector
 Sensor
               ACES 51451-0060N-001
 side
 Cable side Compatible with ACES 51452-006H0H0-001 (e.g.,
            JST GHR-06V-S)
Table 10: SEN5x connector
 Pin    Name        Description                  Comments
 1      VDD         Supply voltage               5V ± 10%
 2      GND         Ground
 3      SDA         Serial data input / output   LVTTL 3.3V
                                                 compatible
 4      SCL         Serial clock input           LVTTL 3.3V               Figure 4 Pin layout. The communication interface
                                                 compatible           connector (ACES 51451-0060N-001) is located at the side
                                                 Connect to                    of the sensor adjacent to the air outlet.
 5      SEL         Interface select
                                                 GND
 6      NC          Do not connect

Table 11: SEN5x pin assignment.
Note, that there is an internal electrical connection between GND pin (2) and metal shielding. Keep this metal shielding
electrically floating to avoid any unintended currents through this internal connection. If this is not an option, proper
external potential equalization between GND pin and any potential connected to the shielding is mandatory. Any current
though the connection between GND and metal shielding may damage the product and poses a safety risk through
overheating.
www.sensirion.com                                  Version 2 – D1 – March 2022                                           13/30
5 Functional Overview

           5.1 Operating Modes
                                                                          Start
                                                                      RHT/Gas-Only         Start
                                                                      Measurement       Measurement
Figure 5 SEN5x operating modes. The RHT/Gas-Only Measurement Mode is applicable for SEN55 and SEN54 only. The direct
switch between Measurement and RHT/Gas-Only Measurement mode is available only for firmware version v2 and newer.

Idle
           The module is in Idle Mode after power on or reset.
           Most of the internal electronics switched off /reduced power consumption.
           Fan and laser are switched off.
           The module is ready to receive and process any command.

Measurement
           All electronics switched on / max. power consumption.
           The measurement is running, and the module is continuously processing measurement data.
           New readings are available every second.

RHT/Gas-Only Measurement
           The RHT/Gas-Only Measurement mode can be entered from Idle and the Measurement modes. The direct
            switch between Measurement and RHT/Gas-Only Measurement mode is available only for firmware version v2
            and newer.
           Fan and laser are switched off for reduced power consumption.
           RHT and gas sensor are switched on. RHT and gas measurement is running, and the module is continuously
            processing measurement data.
           New readings are available every second.
           The PM output is 0xFFFF
www.sensirion.com                                 Version 2 – D1 – March 2022                                  14/30
          5.2 Fan Auto Cleaning
When the module is in Measurement-Mode an automatic fan-cleaning procedure will be triggered periodically following
a defined cleaning interval. This will accelerate the fan to maximum speed for 10 seconds to blow out the accumulated
dust inside the fan.
            Measurement values are not updated while the fan-cleaning is running.
            The cleaning interval is set to 604’800 seconds (i.e., 168 hours or 1 week) with a tolerance of 3%.
            The interval can be configured using the Set Automatic Cleaning Interval command.
            Set the interval to 0 to disable the automatic cleaning.
            A sensor reset, resets the cleaning interval to its default value
            If the sensor is switched off, the time counter is reset to 0. Make sure to trigger a cleaning cycle at least every
             week if the sensor is switched off and on periodically (e.g., once per day).
            The cleaning procedure can also be started manually with the Start Cleaning command.

          5.3 Temperature compensation
By default, the temperature and humidity outputs from the sensor are compensated for the modules self-heating. If the
module is designed into a device, the temperature compensation might need to be adapted to incorporate the change in
thermal coupling and self-heating of other device components.
A guide to achieve optimal performance, including references to mechanical design-in examples can be found in the app
note “Temperature Acceleration and Compensation Instructions for SEN5x” at www.sensirion.com.
         5.4 Device Status Register
The Device Status Register is a 32-bit register that contains information about the internal state of the module.
   31         30      29      28      27      26      25      24      23       22       21       20     19     18     17     16
                                                                                      Warning           Info

  res.       res.    res.    res.    res.    res.     res.   res.     res.    res.    SPEED     res.    FAN    res.   res.   res.
   15         14      13      12      11      10       9      8        7       6         5       4       3      2      1      0
                                                                     Error    Error    Error    Error
                                                                      GAS
              res.   res.    res.    res.    res.     res.   res.             RHT     LASER     FAN     res.   res.   res.   res.
                                                                    SENSOR
Note:        All “res.” bits are reserved for internal use or future versions. These bits can be both 0 and 1 and should therefore
             be ignored.
 Bit 21 SPEED: Fan speed out of range
               0: Fan speed is ok.
               1: Fan speed is too high or too low.
              During the first 3 seconds after starting the measurement (fan start-up) the fan speed is not checked.
              The fan speed is also not checked during the auto cleaning procedure.
              Apart from the two exceptions mentioned above, the fan speed is checked once per second in the
               measurement mode. If it is out of range twice in succession, the SPEED-bit is set.
              At very high or low ambient temperatures, the fan may take longer to reach its target speed after start-up. In
               this case, the bit will be set. As soon as the target speed is reached, this bit is cleared automatically.
              If this bit is constantly set, this indicates a problem with the power supply or that the fan is no longer working
               properly

www.sensirion.com                                     Version 2 – D1 – March 2022                                            15/30
 Bit 19 FAN: Fan cleaning active
           0: Fan is running normal.
           1: Active during the automatic cleaning procedure of the fan

  Bit 7 GAS SENSOR: Gas sensor error (VOC & NOx)
           0: Gas sensor is running normal.
           1: Gas sensor error

  Bit 6 RHT: RHT communication error
           0: RHT sensor is running normal.
           1: Error in internal communication with the RHT sensor

  Bit 5 LASER: Laser failure
           0: Laser current is ok.
           1: Laser is switched on and current is out of range.
          The laser current is checked once per second in the measurement mode. If it is out of range, the LASER-bit
           is set.
          If the laser current is back within limits, this bit will be not cleared automatically.
          A laser failure can occur at very high temperatures outside of specifications or when the laser module is
           defective.

  Bit 4 FAN: Fan failure, fan is mechanically blocked or broken.
         0: Fan works as expected.
         1: Fan is switched on, but the measured fan speed is 0 RPM.
          The fan is checked once per second in the measurement mode. If 0 RPM is measured twice in succession,
           the FAN bit is set.
          The FAN-bit will not be cleared automatically.
          A fan failure can occur if the fan is mechanically blocked or broken.
www.sensirion.com                                  Version 2 – D1 – March 2022                                  16/30
6 Operation and Communication through the I2C Interface

                                                                         Usage:
                                                                             I2C address:      0x69
                                                                             Max. speed:       standard mode, 100 kbit/s
                                                                             Clock stretching: not used

                                                                         Both SCL and SDA lines are open drain I/Os. They should
                                                                         be connected to external pull-up resistors (e.g. Rp = 10
                                                                         kΩ). Important notice: in order to correctly select I2C as
                                                                         interface, the interface select (SEL) pin must be pulled to
                                                                         GND before or at the same time the sensor is powered up.

Figure 6: Typical I2C application circuit.

To avoid electromagnetic interference and crosstalk, use as short as possible electronic connections (< 10 cm) and/or
well shielded connection cables.
For detailed information on the I2C protocol, refer to NXP I2C-bus specification14.

        Checksum Calculation
The Read and Write Commands transmit the data in 2-byte packets, followed by an 8-bit checksum. The checksum is
calculated as follows:

Property            Value                                                  uint8_t CalcCrc(uint8_t data[2]) {
Name                CRC-8                                                    uint8_t crc = 0xFF;
                                                                             for(int i = 0; i < 2; i++) {
Protected Data      read and/or write data                                     crc ^= data[i];
                                                                               for(uint8_t bit = 8; bit > 0; --bit) {
Width               8 bit                                                        if(crc & 0x80) {
Polynomial          0x31 (x^8 + x^5 + x^4 + 1)                                     crc = (crc << 1) ^ 0x31u;
                                                                                 } else {
Initialization      0xFF                                                           crc = (crc << 1);
Reflect Input       false                                                        }
                                                                               }
Reflect Output      false                                                    }
                                                                             return crc;
Final XOR           0x00                                                   }
Example             CRC(0xBEEF) = 0x92

Please note that the checksums are used only for the 2-byte data packets. The command code itself already contains a
3-bit CRC and therefore no checksum must be appended to it.
14 http://www.nxp.com/documents/user_manual/UM10204.pdf
www.sensirion.com                                         Version 2 – D1 – March 2022                                          17/30
       6.1 I2C Commands
The following table shows an overview of the available I2C commands.
    Address
                    Command Name                      Communication                     Command execution time
    Pointer
    0x0021          Start Measurement                 Write Data                        < 50 ms
    0x0037          Start Measurement in              Write Data                        < 50 ms
                    RHT/Gas-Only Measurement Mode
    0x0104          Stop Measurement                  Write Data                        < 200 ms
    0x0202          Read Data-Ready Flag              Read/ Write Data                  < 20 ms
    0x03C4          Read Measured Values              Read/ Write Data                  < 20 ms
    0x60B2          Read/ Write Temperature           Read/ Write Data and Parameters   < 20 ms
                    Compensation Parameters
    0x60C6          Read/ Write Warm Start            Read/ Write Data and Parameters   < 20 ms
                    Parameters
    0x60D0          Read/Write VOC Algorithm Tuning Read/ Write Data and Parameters     < 20 ms
                    Parameters
    0x60E1          Read/Write NOx Algorithm Tuning Read/ Write Data and Parameters     < 20 ms
                    Parameters
    0x60F7          Read/Write RH/T Acceleration      Read/ Write Data and Parameters   < 20 ms
                    Mode
    0x6181          Read/Write VOC Algorithm State    Read/ Write Data and Parameters   < 20 ms
    0x5607          Start Fan Cleaning                Write Data                        < 20 ms
    0x8004          Read/Write Auto Cleaning Interval Read/ Write Data and Parameters   < 20 ms
    0xD014          Read Product Name                 Read/ Write Data                  < 20 ms
    0xD033          Read Serial Number                Read/ Write Data                  < 20 ms
    0xD100          Read Firmware Version             Read/ Write Data                  < 20 ms
    0xD206          Read Device Status                Read/ Write Data                  < 20 ms
    0xD210          Clear Device Status               Write Data                        < 20 ms
    0xD304          Reset                             Write Data                        < 100 ms
Table 12: Reference table for I2C commands.

Please note that all commands are volatile.
     6.1.1 Start Measurement (0x0021)
Starts the measurement. After power up, the module is in Idle-Mode. Before any measurement values can be read, the
Measurement-Mode needs to be started using this command.

     6.1.2 Start Measurement in RHT/Gas-Only Measurement Mode (0x0037)
Starts a continuous measurement without PM. Only humidity, temperature, VOC, and NOx are available in this mode.
Laser and fan are switched off to keep power consumption low.

     6.1.3 Stop Measurement (0x0104)
Stops the measurement. Use this command to return to the initial state (Idle-Mode).

     6.1.4 Read Data-Ready Flag (0x0202)
This command can be used for polling to find out when new measurements are available.
www.sensirion.com                                 Version 2 – D1 – March 2022                                    18/30
Read/Write Data:

  Byte #       Description
    0          unused, always 0x00
    1          Data-Ready Flag
               0x00: no new measurements available
               0x01: new measurements ready to read
    2          Checksum for bytes 0, 1
     6.1.5 Read Measured Values (0x03C4)
Reads the measured values from the sensor module and resets the “Data-Ready Flag”. If the sensor module is in
Measurement-Mode, an updated measurement value is provided every second and the “Data-Ready Flag” is set. If no
synchronized readout is desired, the “Data-Ready Flag” can be ignored. The command “Read Measured Values” always
returns the latest measured values. After sending the “Read Measured Values” command, a wait time of 10 ms is needed
so that the sensor internally can fill the data buffers. After 20 ms, the read data header can be sent to read out the sensor
data. In RHT/Gas-Only Measurement Mode, the PM output is 0xFFFF. If any value is unknown, 0xFFFF is returned.

Command               Returned data
0x03C4                PM Mass concentration, Relative humidity, Temperature, VOC Index, NOx Index

Read/Write Data:

        Byte #        Datatype                    Scale factor      Description
         0..1         big-endian, uint16          10                Mass Concentration PM1.0 [µg/m³]
           2          Checksum for bytes 0, 1
         3..4         big-endian, uint16          10                Mass Concentration PM2.5 [µg/m³]
           5          Checksum for bytes 3, 4
         6..7         big-endian, uint16          10                Mass Concentration PM4.0 [µg/m³]
           8          Checksum for bytes 6, 7
        9..10         big-endian, uint16          10                Mass Concentration PM10 [µg/m³]
         11           Checksum for bytes 9, 10
        12..13        big-endian, int16           100               Compensated Ambient Humidity [%RH]
         14           Checksum for bytes 12, 13
        15..16        big-endian, int16           200               Compensated Ambient Temperature [°C]
         17           Checksum for bytes 15, 16
        18..19        big-endian, int16           10                VOC Index
         20           Checksum for bytes 18, 19
        21..22        big-endian, int16           10                NOx Index
         23           Checksum for bytes 21, 22
www.sensirion.com                                      Version 2 – D1 – March 2022                                      19/30
     6.1.6 Read/ Write Temperature Compensation Parameters (0x60B2)
These commands allow to compensate temperature effects of the design-in at customer side by applying a custom
temperature offset to the ambient temperature. The compensated ambient temperature is calculated as follows:

T_Ambient_Compensated = T_Ambient + (slope*T_Ambient) + offset

Where slope and offset are the values set with this command, smoothed with the specified time constant. The time
constant is how fast the slope and offset are applied. After the speciﬁed value in seconds, 63% of the new slope
and offset are applied.
More details about the tuning of these parameters are included in the application note “Temperature Acceleration and
Compensation Instructions for SEN5x”.

All temperatures (T_Ambient_Compensated,T_Ambient and offset) are represented in °C.
Read/Write Data and Parameters:

      Byte #        Datatype                  Scale factor   Description
       0..1         big-endian, int16         200            Temperature offset [°C] (default value: 0)
        2           Checksum for bytes 0, 1
       3..4         big-endian, int16         10000          Normalized temperature offset slope (default value: 0)
        5           Checksum for bytes 3, 4
       6..7         big-endian, uint16        1              Time constant in seconds (default value: 0)
        8           Checksum for bytes 6, 7

     6.1.7 Read/ Write Warm Start Parameter (0x60C6)
The temperature compensation algorithm is optimized for a cold start by default, i.e., it is assumed that the "Start
Measurement" commands are called on a device not yet warmed up by previous measurements. If the measurement is
started on a device that is already warmed up, this parameter can be used to improve the initial accuracy of the
ambient temperature output. This parameter can be gotten and set in any state of the device, but it is applied only the
next time starting a measurement, i.e., when sending a "Start Measurement" command. So, the parameter needs to
be written before a warm-start measurement is started.

Read/Write Data and Parameters:

      Byte #        Datatype                           Scale factor             Description
       0..1         big-endian, uint16                 1                        Warm start behavior as a value in the range from
                                                                                0 (cold start, default value) to 65535 (warm start).
                                                                                (default value: 0)
        2           Checksum for bytes 0, 1
www.sensirion.com                                 Version 2 – D1 – March 2022                                                   20/30
     6.1.8 Read/ Write VOC Algorithm Tuning Parameters (0x60D0)
The VOC algorithm can be customized by tuning 6 different parameters. More details on the tuning instructions are
provided in the application note “Engineering Guidelines for SEN5x”. Note that this command is available only in idle
mode. In measure mode, this command has no effect. In addition, it has no effect if at least one parameter is outside
the speciﬁed range.

Read/Write Data and Parameters:

      Byte #                                    Scale
                    Datatype                               Description
                                                factor
       0..1         big-endian, int16           1          Index Offset
                                                           VOC index representing typical (average) conditions. Allowed
                                                           values are in range 1..250. The default value is 100.
        2           Checksum for bytes 0, 1
       3..4         big-endian, int16           1          Learning Time Offset Hours
                                                           Time constant to estimate the VOC algorithm offset from the
                                                           history in hours. Past events will be forgotten after about twice the
                                                           learning time. Allowed values are in range 1..1000. The default
                                                           value is 12 hours.
        5           Checksum for bytes 3, 4
       6..7         big-endian, int16           1          Learning Time Gain Hours
                                                           Time constant to estimate the VOC algorithm gain from the history
                                                           in hours. Past events will be forgotten after about twice the
                                                           learning time. Allowed values are in range 1..1000. The default
                                                           value is 12 hours.
        8           Checksum for bytes 6, 7
       9..10        big-endian, int16           1          Gating Max Duration Minutes
                                                           Maximum duration of gating in minutes (freeze of estimator during
                                                           high VOC index signal). Zero disables the gating. Allowed values
                                                           are in range 0..3000. The default value is 180 minutes.
        11          Checksum for bytes 9, 10
      12..13        big-endian, int16           1          Std Initial
                                                           Initial estimate for standard deviation. Lower value boosts events
                                                           during initial learning period, but may result in larger device-to-
                                                           device variations. Allowed values are in range 10..5000. The
                                                           default value is 50.
        14          Checksum for bytes 12, 13
      15..16        big-endian, int16           1          Gain Factor
                                                           Gain factor to amplify or to attenuate the VOC index output.
                                                           Allowed values are in range 1..1000. The default value is 230.
        17          Checksum for bytes 15, 16
www.sensirion.com                               Version 2 – D1 – March 2022                                                 21/30
     6.1.9 Read/ Write NOx Algorithm Tuning Parameters (0x60E1)
The NOx algorithm can be customized by tuning 6 different parameters. More details on the tuning instructions are
provided in the application note “Engineering Guidelines for SEN5x”. This command is available only in idle mode. In
measure mode, this command has no effect. In addition, it has no effect if at least one parameter is outside the
speciﬁed range.

Read/Write Data and Parameters:

      Byte #        Datatype                   Scale factor   Description
       0..1         big-endian, int16          1              Index Offset
                                                              NOx index representing typical (average) conditions. Allowed
                                                              values are in range 1..250. The default value is 1.
        2           Checksum for bytes 0, 1
       3..4         big-endian, int16          1              Learning Time Offset Hours
                                                              Time constant to estimate the NOx algorithm offset from the
                                                              history in hours. Past events will be forgotten after about twice the
                                                              learning time. Allowed values are in range 1..1000. The default
                                                              value is 12 hours.
        5           Checksum for bytes 3, 4
       6..7         big-endian, int16          1              Learning Time Gain Hours
                                                              The time constant to estimate the NOx algorithm gain from the
                                                              history has no impact for NOx. This parameter is still in place for
                                                              consistency reasons with the VOC tuning parameters command.
                                                              This parameter must always be set to 12 hours.
        8           Checksum for bytes 6, 7
       9..10        big-endian, int16          1              Gating Max Duration Minutes
                                                              Maximum duration of gating in minutes (freeze of estimator during
                                                              high NOx index signal). Set to zero to disable the gating. Allowed
                                                              values are in range 0..3000. The default value is 720 minutes.
        11          Checksum for bytes 9, 10
      12..13        big-endian, int16          1              Std Initial
                                                              The initial estimate for standard deviation parameter has no
                                                              impact for NOx. This parameter is still in place for consistency
                                                              reasons with the VOC tuning parameters command. This
                                                              parameter must always be set to 50.
        14          Checksum for bytes 12,
                    13
      15..16        big-endian, int16          1              Gain Factor
                                                              Gain factor to amplify or to attenuate the NOx index output.
                                                              Allowed values are in range 1..1000. The default value is 230.
        17          Checksum for bytes 15,
                    16
www.sensirion.com                                  Version 2 – D1 – March 2022                                                   22/30
     6.1.10 Read/ Write RH/T Acceleration Mode (0x60F7)
By default, the RH/T acceleration algorithm is optimized for a sensor which is positioned in free air. If the sensor is
integrated into another device, the ambient RH/T output values might not be optimal due to different thermal behavior.
This parameter can be used to adapt the RH/T acceleration behavior for the actual use-case, leading in an
improvement of the ambient RH/T output accuracy. There is a limited set of different modes available, each identiﬁed
by a number:

• 0: Low Acceleration
• 1: High Acceleration
• 2: Medium Acceleration

Medium and high accelerations are particularly indicated for air quality monitors which are subjected to large
temperature changes. Low acceleration is advised for stationary devices not subject to large variations in temperature.
This parameter can be changed in any state of the device, but it is applied only the next time starting a measurement,
i.e., when sending a "Start Measurement" command. So, the parameter needs to be set before a new measurement is
started.

Read/Write Data and Parameters:

      Byte #        Datatype                   Scale factor   Description
       0..1         big-endian, uint16         1              RH/T acceleration mode.
        2           Checksum for bytes 0, 1

     6.1.11 Read/ Write VOC Algorithm State (0x6181)
Allows to backup and restore the VOC algorithm state to resume operation after a short interruption, skipping initial
learning phase. By default, the VOC algorithm resets its state to initial values each time a measurement is started,
even if the measurement was stopped only for a short time. So, the VOC index output value needs a long time until it is
stable again. This can be avoided by restoring the previously memorized algorithm state before starting the measure
mode.
Read/Write Data and Parameters:

      Byte #        Datatype                   Scale factor   Description
       0..1         Bytearray8                 1              VOC algorithm state.
        2           Checksum for bytes 0, 1
        …
       9..10        Bytearray8                 1
        11          Checksum for bytes 9, 10
     6.1.12 Start Fan Cleaning (0x5607)
Starts the fan-cleaning manually. This command can only be executed in Measurement-Mode. For more details, note
the explanations given in 5.2 Fan Auto Cleaning.

     6.1.13 Read/Write Auto Cleaning Interval (0x8004)
Reads/Writes the interval [s] of the periodic fan-cleaning. For more details, note the explanations given in 5.2 Fan Auto
Cleaning. Please note that since this configuration is volatile, it will be reverted to the default value after a device reset.

www.sensirion.com                                  Version 2 – D1 – March 2022                                            23/30
Read/Write Data and Parameters:

    Byte #         Description
     0, 1          Most Significant Byte                 big-endian, unsigned 32-bit integer value:
      2            Checksum for bytes 0, 1               Auto Cleaning Interval [s]
     3, 4          Least Significant Byte
      5            Checksum for bytes 3, 4

     6.1.14 Read Product Name (0xD014)
This command returns the product name SEN5x (SEN50, SEN54 or SEN55). It is defined as a string value with a
maximum length of 32 ASCII characters (including terminating null-character).

Read/Write Data:

  Byte #     Description
    0        ASCII Character 0
    1        ASCII Character 1
    2        Checksum for bytes 0, 1
    …        …
   45        ASCII Character 30
   46        ASCII Character 31
   47        Checksum for bytes 45, 46
     6.1.15 Read Serial Number (0xD033)
This command returns the requested serial number. It is defined as a string value with a maximum length of 32 ASCII
characters (including terminating null-character).
Read/Write Data:

  Byte #     Description
    0        ASCII Character 0
    1        ASCII Character 1
    2        Checksum for bytes 0, 1
    …        …
   45        ASCII Character 30
   46        ASCII Character 31
   47        Checksum for bytes 45, 46
     6.1.16 Read Firmware Version (0xD100)
Get firmware version.
Read/Write Data:

  Byte #     Description
    0        Firmware version
    1        Reserved

www.sensirion.com                            Version 2 – D1 – March 2022                                      24/30
    2      Checksum for bytes 0, 1
     6.1.17 Read Device Status (0xD206)
Use this command to read the Device Status Register. For more details, note the explanations given in section 5.4
Device Status Register.
Read/Write Data:

  Byte #   Description
   0, 1    Most Significant Byte          big-endian, unsigned 32-bit integer value:
    2      Checksum for bytes 0, 1        Device Status Register
   3, 4    Least Significant Byte
    5      Checksum for bytes 3, 4
     6.1.18 Clear Device Status (0xD210)
Clears all flags in device status register.
     6.1.19 Device Reset (0xD304)
Device software reset command. After calling this command, the module is in the same state as after a power reset.
www.sensirion.com                                  Version 2 – D1 – March 2022                                  25/30
7 Technical Drawings

       7.1 Product outline drawings
Figure 7: Package outline dimensions (given in mm) of the SEN5x.
www.sensirion.com                            Version 2 – D1 – March 2022   26/30
       7.2 Product Label
The SEN5x contains a label (size: 18 x 12 mm) which is attached to one side of the sensor and contains the following
information:

Label Design                                                       Label Content          Description
                                                                   SEN5x                  Product name
                                                                   SDN-T                  Sensirion internal marking
                                                                   xxxxxxxxxxxxxxxx / S   16-digit decimal serial number
Table 13 Label information.
     label
    position
Figure 8: Indication of label position on SEN5x.
www.sensirion.com                                  Version 2 – D1 – March 2022                                      27/30
8 Revision History

Date                Version   Page(s)   Changes
January 2022        1         -         Initial version
March 2022          2         4         Updated table
                              9-10      Added Recommended and Absolute Maximum/Minimum Operating and
                                        Storage Conditions for SEN55 and SEN50
                              14        Updated flowchart and description of operating modes
                              23        Updated names for the RH/T Acceleration Mode parameters
www.sensirion.com                       Version 2 – D1 – March 2022                             28/30
9 Important Notices
Warning, Personal Injury
 Do not use this product as safety or emergency stop devices or in any other application where failure of the
 product could result in personal injury. Do not use this product for applications other than its intended and
 authorized use. Before installing, handling, using or servicing this product, please consult the data sheet and
 application notes. Failure to comply with these instructions could result in death or serious injury.
 If the Buyer shall purchase or use SENSIRION products for any unintended or unauthorized application, Buyer shall
 defend, indemnify and hold harmless SENSIRION and its officers, employees, subsidiaries, affiliates and distributors
 against all claims, costs, damages and expenses, and reasonable attorney fees arising out of, directly or indirectly, any
 claim of personal injury or death associated with such unintended or unauthorized use, even if SENSIRION shall be
 allegedly negligent with respect to the design or the manufacture of the product.
 ESD Precautions
 The inherent design of this component causes it to be sensitive to electrostatic discharge (ESD). To prevent ESD-
 induced damage and/or degradation, take customary and statutory ESD precautions when handling this product.
 See application note “ESD, Latchup and EMC” for more information.
 Warranty
 SENSIRION warrants solely to the original purchaser of this product for a period of 12 months (one year) from the date
 of delivery that this product shall be of the quality, material and workmanship defined in SENSIRION’s published
 specifications of the product. Within such period, if proven to be defective, SENSIRION shall repair and/or replace this
 product, in SENSIRION’s discretion, free of charge to the Buyer, provided that:
  notice in writing describing the defects shall be given to SENSIRION within fourteen (14) days after their
      appearance;
  such defects shall be found, to SENSIRION’s reasonable satisfaction, to have arisen from SENSIRION’s faulty
      design, material, or workmanship;
  the defective product shall be returned to SENSIRION’s factory at the Buyer’s expense; and
  the warranty period for any repaired or replaced product shall be limited to the unexpired portion of the original
      period.
 This warranty does not apply to any equipment which has not been installed and used within the specifications
 recommended by SENSIRION for the intended and proper use of the equipment. EXCEPT FOR THE WARRANTIES
 EXPRESSLY SET FORTH HEREIN, SENSIRION MAKES NO WARRANTIES, EITHER EXPRESS OR IMPLIED,
 WITH RESPECT TO THE PRODUCT. ANY AND ALL WARRANTIES, INCLUDING WITHOUT LIMITATION,
 WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE, ARE EXPRESSLY
 EXCLUDED AND DECLINED.
 SENSIRION is only liable for defects of this product arising under the conditions of operation provided for in the data
 sheet and proper use of the goods. SENSIRION explicitly disclaims all warranties, express or implied, for any period
 during which the goods are operated or stored not in accordance with the technical specifications.
 SENSIRION does not assume any liability arising out of any application or use of any product or circuit and specifically
 disclaims any and all liability, including without limitation consequential or incidental damages. All operating
 parameters, including without limitation recommended parameters, must be validated for each customer’s applications
 by customer’s technical experts. Recommended parameters can and do vary in different applications.
 SENSIRION reserves the right, without further notice, (i) to change the product specifications and/or the information in
 this document and (ii) to improve reliability, functions and design of this product.
 Copyright © 2021, by SENSIRION. CMOSens® is a trademark of Sensirion. All rights reserved
www.sensirion.com                                 Version 2 – D1 – March 2022                                            29/30
Headquarters and Subsidiaries
Sensirion AG               Sensirion Inc., USA                     Sensirion Korea Co. Ltd.
Laubisruetistr. 50         phone: +1 312 690 5858                  phone: +82 31 337 7700~3
CH-8712 Staefa ZH          info-us@sensirion.com                   info-kr@sensirion.com
Switzerland                www.sensirion.com                       www.sensirion.com/kr

phone: +41 44 306 40 00    Sensirion Japan Co. Ltd.                Sensirion China Co. Ltd.
fax:   +41 44 306 40 30    phone: +81 3 3444 4940                  phone: +86 755 8252 1501
info@sensirion.com         info-jp@sensirion.com                   info-cn@sensirion.com
www.sensirion.com          www.sensirion.com/jp                    www.sensirion.com/cn

Sensirion Taiwan Co. Ltd
phone: +886 3 5506701
info@sensirion.com
www.sensirion.com          To find your local representative, please visit www.sensirion.com/distributors
www.sensirion.com                  Version 2 – D1 – March 2022                                         30/30

