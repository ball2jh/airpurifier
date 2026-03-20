---
source: Sensirion_Mechanical_Design_and_Assembly_Guidelines_SEN5x.pdf
generated: 2026-03-20
---

Mechanical Design and Assembly Guidelines for SEN5x
Particulate Matter Sensor

    Preface
    To ensure the best performance of the sensor in the end user device it is important to consider a few
    recommendations when designing a product using SEN5x. This application note will present the main design-
    in and assembly guidelines for the best sensor performance.
1    Package
SEN5x features two air inlets and one air outlet that should not be obstructed and should be properly coupled to ambient air.
The ambient particulate matter will flow through the sensor thanks to an integrated fan, active during sensor operation. The
metal casing of the SEN5x is covered in a plastic foil to protect it during shipping. The foil has no impact on the sensor
performance and thus does not need to be removed for mechanical assembly.
                                                     Sensor package
                                                                   Outlet
                                                                                                                    Inlets
                                                                                                              FRONT VIEW
                                                                   Connector
                                                                                                               REAR VIEW
www.sensirion.com                                 Version 1.0 – June 2021                                               1/10
2      Placement of the Sensor
2.1 Coupling to Ambient
A good coupling of the inlets and outlet of the SEN5x to the ambient air via the device openings and a suitable device design is
essential to accurately measure ambient air quality.
Ideally, the sensor is mounted such that the inlet as well as outlet are connected directly to ambient air.
If a channel is required a shorter channel length d is preferred. The width of input win and output wout channel should never
restrict the airflow; the width of the output channel wout can be made arbitrarily wide.
It is essential for any design that inlet and outlet are well insulated from each other by proper sealing1. Inlet and outlet
need to be sealed tightly from the rest of the device’s volume to avoid sucking air through any parasitic channels e.g.
from the inside of the device.
In the application note “Mechanical design-in example for SEN5x” we provide a tested design-in proposal that shows
how to mount SEN5x in the end product without the need for additional sealing material.
                Input and output need to be well insulated from each other and from the rest of the device’s volume
                  Proper sealing can be achieved by
                  a tight fit or soft sealing material

                                    AMBIENT
                                                                                                                            AMBIENT
                                                                      SIDE VIEW
                                                                                                                                                              SIDE VIEW
1 Selection of appropriate material for insulation is essential to avoid contamination of the sensor. For more information about material selection see “SEN5x Handling
Instructions”
www.sensirion.com                                                      Version 1.0 – June 2021                                                                            2/10
                    AMBIENT                                 AMBIENT
                                                  Bad
     Bad                                        isolation
   isolation
                    SIDE VIEW                               SIDE VIEW
www.sensirion.com               Version 1.0 – June 2021                 3/10
2.2 Orientation

                                                  Vertical placement
   Placing the sensor with the inlets/outlet facing down avoids dust accumulation and accelerated sensor aging.

                                                                                      AMBIENT
                        AMBIENT
                                                SIDE VIEW                                                    SIDE VIEW

                                                 Lateral placement
   Inlets should always be above outlet to avoid particles getting back from the outlet to the inlets due to gravity.
    AMBIENT                                                                                                      AMBIENT
                                                SIDE VIEW                                                    SIDE VIEW
www.sensirion.com                               Version 1.0 – June 2021                                                    4/10
                     Horizontal placement
                    Both orientations are ok
                    FRONT VIEW                 FRONT VIEW
www.sensirion.com    Version 1.0 – June 2021           5/10
2.3 Isolation from Airflow
External airflows can generate a pressure drop between inlets and outlet and alter the sensor reading. Very strong flows can
also physically prevent particles from entering the sensor inlet channels. The sensor should be isolated from the airflow of the
final device (e.g., air purifier) if the velocity of this flow is greater than 1 m/s. For a design-in where the external flow velocity is
greater than 1 m/s contact Sensirion for more information.
                       Isolate sensor from external airflows if the flow velocity is greater than 1 m/s.
   AMBIENT
                                                                           AMBIENT
                                                       SIDE VIEW                                                           SIDE VIEW
                                                       SIDE VIEW                                                           SIDE VIEW
www.sensirion.com                                      Version 1.0 – June 2021                                                      6/10
2.4 Decoupling from External Heat Sources
Sensirion SEN5x sensor output is compensated for self-heating of the module itself. If the sensor is built into a system, other
heat sources such as microcontrollers, battery, Wi-Fi module, display, etc. add an additional temperature offset.
While SEN5x internal temperature compensation algorithm2 can be adapted to deal with some additional heating, a degradation
of performance is expected for excessive temperature offsets.
Thus it is beneficial to design the SEN5x as far apart from internal heat sources.
It is further recommended to place the SEN5x below heat sources as air convection arising from heat sources might heat up the
sensor.
                                              Avoid placement of the sensor close to heat sources.
                                   AMBIENT                                                           AMBIENT
                                                                    SIDE VIEW
                                                                                                                  SIDE VIEW
2 For further details, please refer to the document “SEN5x –Temperature Compensation Instruction”.
www.sensirion.com                                                   Version 1.0 – June 2021                               7/10
2.5 Protection from Sunlight
Exposing the SEN5x to direct sunlight might introduce temperature gradients and accelerate the aging of the SEN5x. Thus it is
recommended to protect the sensor from direct sunlight. This can be achieved by a suitable design-in or by using a light shade.
                                    Avoid exposure of the sensor to direct sunlight.
                                                FRONT VIEW                                                     FRONT VIEW
www.sensirion.com                                  Version 1.0 – June 2021                                                8/10
3      Mechanical Assembly Guidelines
The following indications should be followed when assembling the SEN5x:
    • Do not obstruct inlets and outlet.
    • Make sure that inlet and outlet connected via tightly sealed channels to ambient to avoid parasitic air flow
    • Firm mechanical fixations should be used to reduce unwanted noise caused by loose mechanical coupling.
    • Acoustic foam or thin rubber can be used to further reduce noise3.
    • If an all-around casing is used, it is recommended to not cover the entire sensor surface to avoid overheating.

An example mounting is shown below. The red dashed-line regions show the non-obstructed inlets/outlet and connector areas.
                                                                            Snap fixture

              = do not obstruct
                                                                                                                                                       FRONT VIEW
                                                                     SIDE VIEW                                                                          REAR VIEW
3 Note that sensor acoustic emission level is always according to datasheet specifications. Acoustic foam helps to reduce unwanted noise generated by the mechanical

coupling between the sensor and the fixations.

www.sensirion.com                                                    Version 1.0 – June 2021                                                                           9/10
Revision History
    Date                 Version       Page(s)     Changes
    15. June 2021        1.0           All         Initial version
Copyright © 2018 by SENSIRION
CMOSens® is a trademark of Sensirion
All rights reserved
1
     Sensirion AG                          Sensirion Inc., USA                  Sensirion Korea Co. Ltd.
     Laubisruetistr. 50                    phone: +1 312 690 5858               phone: +82 31 337 7700~3
     CH-8712 Staefa ZH                     info-us@sensirion.com                info-kr@sensirion.com
     Switzerland                           www.sensirion.com                    www.sensirion.co.kr

     phone: +41 44 306 40 00               Sensirion Japan Co. Ltd.             Sensirion China Co. Ltd.
     fax:   +41 44 306 40 30               phone: +81 3 3444 4940               phone: +86 755 8252 1501
     info@sensirion.com                    info-jp@sensirion.com                info-cn@sensirion.com
     www.sensirion.com                     www.sensirion.co.jp                  www.sensirion.com.cn

     Sensirion Taiwan Co. Ltd
     phone: +886 3 5506701
     info@sensirion.com                    To find your local representative, please visit
     www.sensirion.com                     www.sensirion.com/distributors
2
www.sensirion.com                                   Version 1.0 – June 2021                                10/10

