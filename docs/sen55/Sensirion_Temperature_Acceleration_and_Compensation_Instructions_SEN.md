---
source: Sensirion_Temperature_Acceleration_and_Compensation_Instructions_SEN.pdf
generated: 2026-03-20
---

Temperature Acceleration and Compensation Instructions for
SEN5x

Preface
Integrating sensor components into systems, e.g., air quality monitors, air purifiers, etc. is a time-
consuming task. It typically takes several design and test iterations until a working design is found.
SEN5x is designed to make this process faster and more straightforward.
This application note explains in detail what to expect in thermal behaviour comparing a bare SEN5x
and a designed-in SEN5x. It will explain how a change in the measurement environment can affect
the temperature reading and lastly give guidance on how to obtain temperature compensation and
acceleration parameters of the STAR engine for your use case.
Standalone sensor versus built-in sensor
Comparing a temperature sensor on a flex PCB and a temperature sensor built into a device with other
components, e.g., display, microprocessor, etc., the two sensors will behave very differently regarding
ambient temperature readings or changes in temperature.

A sensor on a flex PCB without any enclosure has negligible thermal mass and is coupled perfectly to
ambient air. It is able to accurately measure ambient temperature and will be able to react fast to
changes in temperature. A built-in sensor is usually coupled weakly to ambient air, has a larger thermal
mass, and shows additional self-heating due to other heat sources close by. To minimize those effects
one can optimize the mechanical design-in, as well as apply complicated temperature compensation
algorithms.

SEN5x solves most of these issues by design. An optimized flow path together with active ventilation
from the built-in fan significantly improves coupling to ambient air and improves reaction times.
The included algorithm is optimized for compensating the module’s self-heating and, in addition, it
allows for improvement of the response time by customizing the STAR (Sensirion Temperature
Acceleration Routine) engine’s acceleration parameters to the built-in conditions.

Measurement environment for default compensation
The default parameters for the temperature compensation algorithm are obtained using a very specific
and controlled measurement environment. Even small changes to the environment can add
measurement variance and might lead to deviations to a reference. Most noticeable are effects due to
change in ventilation (e.g., temperature-controlled chamber with fan versus water in chamber walls) or
changes in heat coupling (e.g., sensors lying on wood versus metal).

The sensor’s default compensation is optimized for the sensors lying on a wooden table with enough
distance to other sensors or heat sources/sinks to prevent any additional heating/cooling. Any
significant air flow over the sensors should be avoided to prevent additional heat dissipation due to
convection. The reference temperature probe should not be placed too close to the sensors to avoid
any heat transfer.
For the above stated conditions, the sensor will be within the specified limits for relative humidity and
temperature.

www.sensirion.com                               v 1.0 – January 2022                                        1/6
Temperature settings for a given design-in
If SEN5x is integrated (e.g., into an air quality monitor), the default compensation might need to be
adapted for mechanical design-in, e.g., due to a change in thermal coupling, additional thermal mass,
or self-heating of other device components. To make mechanical design-in simpler, we provide
mechanical design-in examples including more detailed instructions and CAD files found at
www.sensirion.com.
Once the sensor is integrated, we suggest the following order of steps to customize the settings:
    • Choose STAR-engine acceleration setting
    • Offset correction and slope
    • Configure warm start behavior

Temperature acceleration for a given design-in
The SEN5x comes with 3 different presets for the Sensirion temperature acceleration routine (STAR).
In the default case a minor acceleration is applied. This setting works well for a standalone module
such as for application in air purifiers. In the application of air quality monitors or mobile devices we
recommend choosing between settings 1 and 2 for high and medium acceleration of the temperature
measurement. The figure shows the difference between the acceleration settings in a measurement for
an exemplary IAQ device. The ambient condition of the devices is changed by 7°C in a step manner.
In order to configure the acceleration, place the device in an environment with a different temperature
together with a reference. Exposing both the device and the reference to standard environment
conditions quickly results in data similar to what is presented in the above figure. Repeating the same
experiment for different acceleration settings the correct configuration is found for the setting where the
device temperature is closest to the reference and almost no overshooting is observed. In the given
example the fastest acceleration effectively reduces the time to reach 63% of the temperature
difference (this is referred to 𝜏63 ) from 24 minutes to 10 minutes for the minor accelerated case.

www.sensirion.com                               v 0.1 – August 2020                                      2/6
Offset correction for a given design-in
Take an accurate external temperature sensor as reference and place it next to your device. Be sure to
place the reference far enough away to avoid measuring heat dissipation from your device. Also be
sure that there are no significant heat fluctuations over time. Wait until both devices are in steady state.
Ideally both sensors already show the same temperature. If there is a temperature offset, calculate the
difference in temperatures. Write this value (multiplied by the factor from the datasheet) as temperature
offset parameter to the sensor. Now the sensor is compensated for your design-in.
Repeating the same procedure at a different temperature, but similar ventilation and environmental
conditions, the slope parameter can be calculated to adjust the offset over a range of temperatures.
The time constant can be used to compensate the warmup phase of the module during the startup of
the sensor.

Power cycling / warm start behavior
The below figure shows the modules temperature raw signal and compensated output for an
experiment with two SEN5x modules and a reference sensor (grey dashed region) on a wooden table.
The modules are powered up consecutively with a delay of approximately 10 minutes. As the modules
warm up due to self-heating (cold start), the temperature reading from the internal temperature sensor
(SHT, dashed line) increases while the compensated output (solid line) shows an accurate reading of
ambient temperature. After approximately 50 minutes, the module described by the orange line was
turned off and on again, simulating a power cycle (warm start). Since the module was already warm, in
the very first moments of operation the temperature reading will show values larger than ambient
temperature until the built-in algorithm realizes the warm start and quickly compensates for the current
conditions. After 7 minutes the sensor is within specifications. Using the warm start parameter this
behavior can be optimized by cutting off the initial peak before compensation. The feature can be set
between the default no cut off setting (parameter equals zero) and maximum cut-off (maximum value),
the optimum value depends on the cooling that took place in the off time of the module.

          29

          28

          27

          26
 T (°C)
          25

          24

          23
            0       10          20           30        40              50           60           70
                                              Time (min)
www.sensirion.com                            v 1.0 – January 2022                                        3/6
Revision History

 Date               Version    Changes
 January 2022       1.0        Initial version
www.sensirion.com             v 1.0 – January 2022   4/6
Important Notices
Warning, Personal Injury
Do not use this product as safety or emergency stop devices or in any other application where failure of the
product could result in personal injury. Do not use this product for applications other than its intended and
authorized use. Before installing, handling, using or servicing this product, please consult the data sheet and
application notes. Failure to comply with these instructions could result in death or serious injury.
If the Buyer shall purchase or use SENSIRION products for any unintended or unauthorized application, Buyer shall
defend, indemnify and hold harmless SENSIRION and its officers, employees, subsidiaries, affiliates and distributors
against all claims, costs, damages and expenses, and reasonable attorney fees arising out of, directly or indirectly,
any claim of personal injury or death associated with such unintended or unauthorized use, even if SENSIRION shall
be allegedly negligent with respect to the design or the manufacture of the product.
ESD Precautions
The inherent design of this component causes it to be sensitive to electrostatic discharge (ESD). To prevent ESD-
induced damage and/or degradation, take customary and statutory ESD precautions when handling this product.
See application note “ESD, Latchup and EMC” for more information.
Warranty
SENSIRION warrants solely to the original purchaser of this product for a period of 12 months (one year) from the
date of delivery that this product shall be of the quality, material and workmanship defined in SENSIRION’s published
specifications of the product. Within such period, if proven to be defective, SENSIRION shall repair and/or replace this
product, in SENSIRION’s discretion, free of charge to the Buyer, provided that:
• notice in writing describing the defects shall be given to SENSIRION within fourteen (14) days after their
     appearance;
• such defects shall be found, to SENSIRION’s reasonable satisfaction, to have arisen from SENSIRION’s faulty
     design, material, or workmanship;
• the defective product shall be returned to SENSIRION’s factory at the Buyer’s expense; and
• the warranty period for any repaired or replaced product shall be limited to the unexpired portion of the original
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
www.sensirion.com                                 v 1.0 – January 2022                                               5/6
Headquarters and Subsidiaries
 Sensirion AG               Sensirion Inc., USA                  Sensirion Korea Co. Ltd.
 Laubisruetistr. 50         phone: +1 312 690 5858               phone: +82 31 337 7700~3
 CH-8712 Staefa ZH          info-us@sensirion.com                info-kr@sensirion.com
 Switzerland                www.sensirion.com                    www.sensirion.com/kr

 phone: +41 44 306 40 00    Sensirion Japan Co. Ltd.             Sensirion China Co. Ltd.
 fax:   +41 44 306 40 30    phone: +81 3 3444 4940               phone: +86 755 8252 1501
 info@sensirion.com         info-jp@sensirion.com                info-cn@sensirion.com
 www.sensirion.com          www.sensirion.com/jp                 www.sensirion.com/cn

 Sensirion Taiwan Co. Ltd
 phone: +886 3 5506701
 info@sensirion.com         To find your local representative, please visit
 www.sensirion.com          www.sensirion.com/distributors
www.sensirion.com                 v 1.0 – January 2022                                      6/6

