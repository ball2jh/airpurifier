---
source: Reduced_Power_Operation_SEN5x.pdf
generated: 2026-03-20
---

Reduced Power Operation for SEN5x
Application note describing SEN5x reduced power mode

Summary
SEN5x is a combo sensor module measuring particulate matter (PM), volatile organic compounds (VOCs), NOx, as well as
relative humidity and temperature (RHT). In its default Measurement mode, it provides new data at a sampling interval of one
second. To reduce power consumption, the SEN5x features an additional operating mode in which laser and fan are switched
off (RHT/Gas-Only Measurement mode, with no PM data).
A correct alternation of the Measurement and RHT/Gas-Only Measurement modes can reduce the power consumption and
allows to operate the SEN5x sensor for an extended periods of time on a tight energy budget, thus making it possible to
potentially use the SEN5x even in battery operated devices.
This document provides detailed instructions on how to choose a suitable sampling interval and subsequently implement a
reduced power operation mode with the SEN5x.
www.sensirion.com                                v 1.0 – August 2022                                                     1/7
1     Overview
The SEN5x sensor module features three different operating modes: Idle, Measurement and RHT/Gas-Only Measurement.
When the sensor is powered up, the SEN5x automatically goes into Idle mode. Starting from Idle mode, the sensor can be put
either into Measurement mode or RHT/Gas-Only Measurement mode. Figure 1 provides a description of all operation modes.
                                          Figure 1: The different operating modes of the SEN5x sensor.

In the Measurement mode, SEN5x provides new data at a sampling interval of one second. In some applications, a PM value
every one second is not necessary. In this situation, it is useful to switch the module to the RHT/Gas-Only Measurement
mode, in which fan and laser are switched off, but the VOC, NOx, and RHT sensors (where present in the considered variant)
are on. For SEN50, a reduced power mode is obtained switching between Measurement and Idle mode.

Reducing the time PM is measured allows to save power consumption considerably. Indeed, the full measurement mode has
an average current consumption of 63 mA, while in the RHT/Gas-Only Measurement mode the current consumption is
reduced to 6.8 mA. The features of the different modes are described in detail in the SEN5x datasheet.

A proper, alternating use of these operation modes as indicated in Figure 2 may reduce power consumption by a factor of 7-9
with only minimal compromises on sensor system performance.

         start                                                                start
      measurement                                                         RTH/Gas-Only      RHT/Gas-Only Measurement Mode
                               Measurement Mode (63 mA avg.)
                                                                          Measurement                (6.8 mA avg.)
                             fan startup +         PM, VOC, NOx and                                  Fan & Laser off,
                          accum. of statistics     RHT data available                              VOC, NOx & RHT on

   Figure 2: Illustration of one complete cycle of reduced power operation. The measurement mode is divided into two phases: The first phase in
measurement mode is characterized by the fan starting up and the PM algorithm accumulating statistics. During this phase, the measurement data
 of the SEN5x is not stable and shall be discarded. In the second phase PM, VOC, NOx and RHT data are updated every second. From this mode
the module can be switched to RHT/Gas-Only Measurement Mode where VOC, NOx and RHT data are updated every second. To obtain again the
        PM output the cycle is repeated. For SEN50, a reduced power operation is obtained switching between Measurement and Idle mode.

There are two main variables influencing the overall power consumption that need to be traded off with performance of the
sensor system: the time spent in measurement mode, as well as the time spent in the RTH/Gas-Only Measurement mode.
             Time in Measurement mode ↔ Ability to detect fast pollution events (High power consumption)

     Time in RHT/Gas-Only Measurement mode ↔ Ability to identify trends and slow pollution events (Low power
                                              consumption)
www.sensirion.com                                        v 1.0 – August 2022                                                               2/7
  Figure 3: Schematic drawing showing the interplay between reducing average current consumption and increasing the sampling
error. It is assumed that the sensor is cycled between the full Measurement Mode for fixed time and then switched to RHT/Gas-only
Measurement Mode for x time, where x is plotted on the horizontal axis. Time is in arbitrary units (a.u.) since quantitative estimates
                                     depend strongly on the type and dynamics of particle events.
In the next sections the main points for choosing appropriate values both for the measurement mode and the RTH/Gas-Only
Measurement mode are explained.
2    Optimizing the Time in Measurement Mode
When the sensor is put into measurement mode, the laser and fan are automatically turned on. To save power, it can be set to
RHT/Gas-Only Measurement mode. However, different limiting factors for the minimal operation time of the full mode must be
considered to maintain a high accuracy in the overall measurement.
2.1 Start-Up Time for Particulate Matter sensing
D o h f ’ i i , it takes a few seconds until it reaches its target speed. This effect can also be observed in the sensor
output during the first seconds.
As statistics is required for particulate matter sensing, the time until a typical stable output value is reached is also depending
on the concentration of particles in the sampled air. In lower concentrations the sensor needs more time than in higher
concentrations.
For a good compromise between accuracy and performance, it is recommended to operate the sensor for a minimum of 30/60s
before using the measurement outputs.
Further optimization is possible by adapting the startup time to the actual measured concentration according to the typical
start-up times given in section Particulate Matter Specifications of the SEN5x datasheet. Please note that the typical start-up
times are mean values, the actual start-up time can vary for different sensors and different aerosols. Considering these
possible variations, it can generally be said that for high concentrations of >100 #/cm3, the measurement value is accurate
enough after 16 seconds. Thus, the following example algorithm can be used to adapt the start-up time to the actual PM
concentration:

    ▪    Measure after 16 seconds
            o If number concentration >100 #/cm3 → measurement data OK to be processed
            o If        b co c      io ≤100 #/cm3 → start-up not complete, measure again after 30 seconds
    ▪    Measure after 30 seconds → measurement data OK to be processed

If, for the benefit of a further reduced power consumption, a lower accuracy of the sensor output can be accepted, it is possible
to further reduce the start-up time, but it is never recommended to go below 8 seconds.
For temperature and relative humidity, temperature compensation of self-heating from fan and laser is required for an
accurate reading. The internal compensation is optimized to automatically compensate between these the two modes. At too
high switching rates the compensation can become unprecise for built-in scenarios. Make sure to keep the time between
switching the modes decently low so the temperature still is within the desired specs. Figure 4 shows an example for a
www.sensirion.com                                   v 1.0 – August 2022                                                            3/7
temperature measurement of a standalone module with multiple switching events between gas only and full measurement
mode.
Figure 4: Automatic compensation of SEN5x. The orange dashed lines shows the overall (averaged) temperature trend, the blue line shows the
temperature measured by the SEN5x module while switching between gas only and full measurement mode. Offsets and saw-tooth behavior in the
compensated and uncompensated T-signals can be observed, depending on the design-in d c c ’ p            .
2.2 Averaging of Data for Particulate Matter sensing
After the start-up time, it is recommended to take several datapoints for the PM measurement and average those in order to
obtain a stable measurement. A good starting point for best accuracy is to average the values of another 30 seconds of
measurements after the start-up time, which results in a total time of 60 seconds in measurement mode. 5 shows a possible
implementation code of this procedure.
A shorter averaging period will save power but may result in a reduced repeatability of the measurement. Whether or not this
is acceptable, needs to be decided based on the power and accuracy requirements of the application.

Pseudo code for low-power measurement with particulate matter sensor

sensor(wake_up)
sensor(start)
sleep(30)
count = 0
PM2p5 = 0
while (count < 30):
  PM2p5 = PM2p5 + sensor(read_values.PM2p5)
  count = count + 1
  sleep(1)
average_PM2p5 = PM2p5 / 30
print(average_PM2p5)
sensor(stop)
sensor(sleep)
Figure 5: Typical Pseudo code for low-power application
3     Optimizing the Time in RHT/Gas-Only Mode
Choosing a suitable sampling interval highly depends on the environment and the use case. If the sensor is placed in an
environment with quickly changing particle concentrations, it is recommended to either use the continuous mode or choose a
short measurement interval of no longer than a few minutes.
A typical example of a fast and slow event can be seen in 6. The chosen sampling interval of 5 minutes is just enough to detect
the first spike, whereas the sampling intervals of 15 minutes and 30 minutes completely miss the first spike. Only the second,
slower event can also be detected with the chosen sampling intervals of 15 minutes and 30 minutes.
www.sensirion.com                                         v 1.0 – August 2022                                                         4/7
Figure 6: Example of fast event and slow event with different sampling time intervals
Most pollution events happen to only decline slowly over time. Therefore, an interval between different measurements of
several minutes (>10 minutes) up to an hour can be sufficient for many applications. Based on our experience and field
measurements, many events like cooking at home can be covered with a measurement interval of 15 minutes.
www.sensirion.com                                         v 1.0 – August 2022                                             5/7
4    Revision History
 Date                   Version    Changes
 August 2022            1.0        Initial version
www.sensirion.com                 v 1.0 – August 2022   6/7
Important Notices
Warning, Personal Injury
  Do not use this product as safety or emergency stop                        •      the warranty period for any repaired or replaced product
  devices or in any other application where failure of the                          shall be limited to the unexpired portion of the original
  product could result in personal injury. Do not use this                          period.
  product for applications other than its intended and                       This warranty does not apply to any equipment which has not
  authorized use. Before installing, handling, using or                      been installed and used within the specifications recommended
  servicing this product, please consult the data sheet and                  by SENSIRION for the intended and proper use of the
  application notes. Failure to comply with these instructions               equipment. EXCEPT FOR THE WARRANTIES EXPRESSLY
  could result in death or serious injury.                                   SET FORTH HEREIN, SENSIRION MAKES NO
                                                                             WARRANTIES, EITHER EXPRESS OR IMPLIED, WITH
   If the Buyer shall purchase or use SENSIRION products for any             RESPECT TO THE PRODUCT. ANY AND ALL WARRANTIES,
   unintended or unauthorized application, Buyer shall defend,               INCLUDING WITHOUT LIMITATION, WARRANTIES OF
   indemnify and hold harmless SENSIRION and its officers,                   MERCHANTABILITY OR FITNESS FOR A PARTICULAR
   employees, subsidiaries, affiliates and distributors against all          PURPOSE, ARE EXPRESSLY EXCLUDED AND DECLINED.
   claims, costs, damages and expenses, and reasonable attorney              SENSIRION is only liable for defects of this product arising
   fees arising out of, directly or indirectly, any claim of personal        under the conditions of operation provided for in the data sheet
   injury or death associated with such unintended or unauthorized           and proper use of the goods. SENSIRION explicitly disclaims all
   use, even if SENSIRION shall be allegedly negligent with                  warranties, express or implied, for any period during which the
   respect to the design or the manufacture of the product.                  goods are operated or stored not in accordance with the
                                                                             technical specifications.
   Warranty
                                                                             SENSIRION does not assume any liability arising out of any
   SENSIRION warrants solely to the original purchaser of this               application or use of any product or circuit and specifically
   product for a period of 12 months (one year) from the date of             disclaims any and all liability, including without limitation
   delivery that this product shall be of the quality, material and          consequential or incidental damages. All operating parameters,
   wo k        hip d fi d i EN I I N’ p b i h d p cific io                   including without limitation recommended parameters, must be
   of the product. Within such period, if proven to be defective,            v id d fo ch c o ’ pp ic io b c o ’
   SENSIRION shall repair and/or replace this product, in                    technical experts. Recommended parameters can and do vary
   SENSIRION’ di c io , f of ch g o h B                    , p ovid d        in different applications.
   that:                                                                     SENSIRION reserves the right, without further notice, (i) to
   •     notice in writing describing the defects shall be given to          change the product specifications and/or the information in this
         SENSIRION within fourteen (14) days after their                     document and (ii) to improve reliability, functions and design of
         appearance;                                                         this product.
   •        ch d f c h b fo d, o EN I I N’                     o b
             i f c io , o h v i       f o EN I I N’ f                        Copyright © 2018, by SENSIRION.
         design, material, or workmanship;                                   CMOSens® is a trademark of Sensirion
   •      h d f c iv p od c h b                 d o EN I I N’                All rights reserved
         factory at the Bu ’ xp           ; d

   Headquarters and Subsidiaries

   SENSIRION AG                                       Sensirion Inc. USA                           Sensirion Korea Co. Ltd.
   Laubisruetistr. 50                                 phone: +1 312 690 5858                       phone: +82 31 337 7700~3
   CH-8712 Staefa ZH                                  info-us@sensirion.com                        info-kr@sensirion.com
   Switzerland                                        www.sensirion.com                            www.sensirion.co.kr

   phone: +41 44 306 40 00                            Sensirion Japan Co. Ltd.                     Sensirion China Co. Ltd.
   fax:    +41 44 306 40 30                           phone: +81 3 3444 4940                       phone: +86 755 8252 1501
   info@sensirion.com                                 info-jp@sensirion.com                        info-cn@sensirion.com
   www.sensirion.com                                  www.sensirion.co.jp                          www.sensirion.com.cn/

   Sensirion Taiwan Co. Ltd.                          To find your local representative, please visit www.sensirion.com/contact
   phone: +41 44 306 40 00
   info@sensirion.com
www.sensirion.com                                           v 1.0 – August 2022                                                                  7/7

