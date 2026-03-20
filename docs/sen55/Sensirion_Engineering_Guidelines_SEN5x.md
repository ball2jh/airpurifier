---
source: Sensirion_Engineering_Guidelines_SEN5x.pdf
generated: 2026-03-20
---

Engineering Guidelines for SEN5x

Applicable to following sensors:
SEN50, SEN54 and SEN55

Key content:
- Initial evaluation and testing
- Electrical and mechanical integration
- Algorithm settings customization
    Summary

    The SEN5x environmental node is a straightforward, all-in-one sensor solution platform for the accurate
    measurement of particulate matter, volatile organic compounds, oxidizing gases, as well as humidity &
    temperature. Each sensing component includes proprietary algorithms that allow an easy integration in various
    applications.

    This application note provides engineers willing to integrate our SEN5x into their product with an overview of
    sensor evaluation criteria, recommended design-in guidelines, mechanical and electrical configurations, inline
    test procedures of the finished product, and further background information. This document offers an overview
    of the available application notes, tools, and datasheet references, please always refer to these documents as
    a key source of comprehensive information and detailed specifications.
www.sensirion.com                              Version 2 – D1 – June 2022                                            1/15
Introduction and Recommended Design-In Process Flowchart

The sensors of the SEN5x family have been specifically designed to allow an easy and handy integration in end-user
products. The scope of this guide is to describe all the necessary steps to successfully integrate the sensor in your
final product.
At Sensirion we have years of experience in supporting customers integrating our sensors in different applications. The
following figure shows our recommendation for an efficient and effective design-in process:
                                                                             IV) Testing and
    I) Sensor            II) Mechanical           III) Electrical                  tuning          V) Setting up
    evaluation              integration            integration               performance of        inline testing
                                                                               final devices
Please note that some process steps will need iterations. Typically, after the first testing of the final device
performance, adjustments of the mechanical and electrical integration still need to be done to optimize performance
and tune the design for the desired behavior. The following sections will guide you through each process.
www.sensirion.com                               Version 2 – D1 – June 2022                                            2/15
I) Sensor Evaluation
In this section, we guide you through the process of pre evaluating the sensor module for your specific application. As
a first step, we recommend you to familiarize yourself with measurements in a tabletop setup. Further measurements
in specific measurement/lab environments (like climate chambers, dust test setups, gas measurement setups) and the
specific user scenario are also possible by using the same test setup.

For electrical and laser safety, the reader is referred to the documents on RoHS/REACH declaration and Laser
certification of the sensor.

Procedure
The fastest way to start an experiment is by using the evaluation kit (SEK-SEN5x) combined with the SEK-
SensorBridge (to be purchased separately from the evaluation kit), and the Sensirion ControlCenter Software.
ControlCenter can be downloaded at https://www.sensirion.com/en/controlcenter/. Connect the sensor to your
computer using the Sensirion SEK-SensorBridge, run ControlCenter, and you are ready to start your experiment.
In the ControlCenter you can access all the data that are measured by the different sensors and visualize them as
presented in the following screenshots:
www.sensirion.com                               Version 2 – D1 – June 2022                                          3/15
At first, we recommend testing the individual sensors responses in small and easy experiments:
      ▪ Blowing into the inlet, one can observe a raise in the humidity.
      ▪ Holding the SEN5x between your closed hands will result in an increase of the temperature signal.
      ▪ Tearing a paper close to the inlet produces a fine particulate matter dust, which is detected by the PM sensor.
      ▪ Let gas from a gas lighter stream into a glass positioned bottom up on a table. Placing SEN5x inside the
           created gas atmosphere will create a detectable increase in the VOC signal of the sensor. More information
           on the working principle of the VOC sensor can be found in the documents “What is a MOX sensor?” and
           “What are reducing gases?”.
      ▪ Use the same setup as for the VOC experiment, but this time ignite the lighter so instead of streaming gas
           into the glass, the atmosphere consists of combustion residues. Placing SEN5x in this atmosphere, a signal in
           the NOx reading is observed. More information on the working principle of the NOx sensor can be found in the
           document “What is a MOX sensor?” and “What are oxidizing gases?”.
      ▪ The VOC can also be tested by exposing the module to low concentration liqueur vapor for a short time.
More quantitative testing guidelines, such as instructions for lab setup-based testing, can be found in the testing guides
for the various integrated sensors (PM, VOC, NOx, RH, T).

Tools
    ▪    SEK-SEN5x evaluation kit
    ▪    SEK-SensorBridge
    ▪    Control Center Software

Documentation
   ▪ SEN5x Datasheet
   ▪ SEN5x Handling Instructions
   ▪ Testing guides
           o PM2.5
           o RH/T
           o VOC and NOx: SGP41 Quick Testing Guide (sensirion.com)
   ▪ Documentation MOX sensor
www.sensirion.com                                Version 2 – D1 – June 2022                                           4/15
              o   Document: What is a MOX sensor?
              o   Document: What are reducing gases?
              o   Document: What are oxidizing gases?
              o   Youtube video VOC and NOx experiment: SGP41 Gas Sensor Evaluation Kit: Introduction -
                  YouTube
    ▪    Statement on Sensor Specification
             o PM2.5
             o RH/T
             o VOC and NOx
    ▪    Additional documentation
             o RoHS/REACH declaration
             o Laser certification
www.sensirion.com                           Version 2 – D1 – June 2022                                    5/15
II) Mechanical Integration
A good mechanical design-in is a key requirement for optimal performance of your device. Design-in can however be a
lengthy time-consuming process when different sensors need to be combined. SEN5x is designed to revolutionize this
process and the customer can benefit from Sensirion’s expertise in providing solutions for implementations in different
applications areas.

Procedure
SEN5x’s air channel geometry is designed for optimal performance of each sensor component. Active ventilation helps
speed up reaction times. Complex compensation and acceleration algorithms are part of SEN5x’s firmware. Lastly, we
provide a tested design-in example which includes a brief description and a CAD file with the actual design. An
example of a best practice design is presented in the figure:
The most important aspects in designing in the module are:
    • Decoupling in- and output via insulation
    • Installing the module in the correct orientation
    • Isolation from airflow
    • Decoupling from external heat and radiation sources

For a more thorough understanding about design-in we recommend using the Mechanical Design and Assembly
Guidelines “SEN5x Mechanical Design-In Instructions”.
Choice of material is key towards optimal performance of the sensor in your device. This is particularly important for
VOC sensing as some kinds of plastics are prone to emitting VOCs themselves. We strongly recommend to test
plastics around the sensor, especially soft plastics, and foams. If you require assistance with material selection,
connect with your Sensirion contact and request material testing for your potential product.

Tools
    ▪    SEN5x Module

Documentation
   ▪ SEN5x Mechanical Design-In Instructions
   ▪ CAD model (STEP)
   ▪ SEN5x Mechanical Design-In Example
www.sensirion.com                                Version 2 – D1 – June 2022                                          6/15
III) Electrical Integration
Besides the mechanical integration, the electrical and software integration are major steps in designing a product. In
this section we provide you with information about electrical requirements and the software we provide for integration.

The SEN module comes with an ACES 51451-0060N-001 connector which is used for power supply and
communication with the sensors. The circuit diagram below shows both the I2C communication interface and the
power supply setup:
The sensor needs to be supplied with 5 V +/- 10%. Constant supply values are desired for optimal performance.
When the sensor is in measurement mode (after first 60 seconds) the typical average supply current is 63mA, while 70
mA at maximum. Considering the start-, and the other operation modes, the maximum peak current is 110 mA.
The operation of the sensor follows the flowchart:
                           Power on / Reset
                                                                             Measurement

                                                                              typ. 63 mA
                                 Idle

                              typ. 2.6 mA                     Start RHT/Gas-Only           Start
                                                                 Measurement            Measurement

                                                                             RHT/Gas-Only
                                                                             Measurement
                                                                              typ. 6.8 mA
More details on the operation modes and how to switch between them are presented in the datasheet.
For experiments using Arduino, or other prototyping platforms and common microcontrollers, our drivers for the desired
platforms can be found on Github. In the corresponding repositories you also find dedicated installation guides.
A full description of the communication protocols and interfaces can be found in the datasheet.

Tools
    ▪    SEN5x Module
    ▪    Jumper wire cable contained in SEK-SEN5x Eval-Kit
    ▪    Electronic prototyping boards
    ▪    Desired software tools

www.sensirion.com                               Version 2 – D1 – June 2022                                           7/15
Documentation
   ▪ Datasheet
   ▪ Driver repositories (https://github.com/sensirion?q=SEN5)
           o Arduino diver repository
           o Raspberry Pi driver repository
   ▪ Tutorials
www.sensirion.com                           Version 2 – D1 – June 2022   8/15
IV) Testing and tuning performance of final devices
For testing our specifications, we have developed specialized setups that require the support of a reference which has
an accuracy at least 10 times higher than the sensor’s tested limits. In general, for the product testing, we instead
recommend testing more use-case-oriented procedures.
Procedure (RH/T)

To optimize the temperature reading performance of a specific product, it is possible to tune the compensation by
changing the offset parameters. Place the device with the built-in sensor next to a reference sensor and compare the
steady state temperature with the one provided by the reference. If an offset is observed, this can be corrected via the
offset value with the I2C command (0x60B2).

SEN5x comes with an already tuned set of parameters for the Sensirion temperature acceleration routine (STAR)
allowing for a quick temperature acceleration of stand-alone modules, and two use cases: Air Purifiers and Air Quality
Monitors. Three different predefined settings for the use of the standalone module and the built-in scenarios are
available with the corresponding I2C command (0x60F7).

In addition, it is possible to define a warm-start scenario. This is done with the command (0x60C6).

The application note “Temperature Acceleration and Compensation Instructions for SEN5x” gives an explanation about
all the temperature measurements and procedures for the customization.

Tools
    ▪    SEN5x based prototype device

Documentation
   ▪ Datasheet
   ▪ Temperature Acceleration and Compensation Instructions for SEN5x
   ▪ Testing guides
           o PM2.5
           o RH/T Testing Guide (sensirion.com)

Procedure (PM)

While there are certainly aerosols well suited for simulating real life PM events in a controlled lab environment, the
necessary equipment is typically bulky and expensive. Instead, we recommend placing a batch of devices into a typical
end-use environment and operating it for a week. This will give the most relevant information about device
performance for applications like Air Purifiers and Air Quality Monitors. There is no tunability for PM.

Tools
    ▪    SEN5x based prototype device

Documentation
   ▪ Datasheet
   ▪ Testing guides
           o PM2.5
www.sensirion.com                               Version 2 – D1 – June 2022                                           9/15
Procedure (VOC and NOx)

Sensirion’s powerful Gas Index Algorithm is ideal for the visualization and interpretation of the VOC and NOx sensor
readings. Its working principle is based on the human perception of smell and explained in the document “What is
Sensirion’s VOC/NOx Index?” in greater detail. The exact implementation can be found in the repository listed in the
documentation section. The algorithm by default maps the VOC readings to a VOC scale from 1 to 500 where 100
refers to the average condition (see “What is the VOC Index?” for more information) and the NOx values are mapped to
a NOx scale from 1 to 500, where everything above 1 is an event (see “What is the NOx Index?” for more information).

Generally, the algorithms are tuned in such a way that the default output is useful for a wide range of applications. The
response of the VOC Algorithm can however be tuned to specific applications by adjusting up to six different
parameters as stated in the datasheet:
    1. Index Offset: By default, the average VOC condition is mapped to VOC Index = 100. In this way, it is possible
        to discriminate between fresh-air (VOC Index < 100) and VOC events (VOC Index > 100). This mapping can
        be changed to values from 1 to 250 to decrease/increase the visual focus on fresh-air events on the VOC
        Index scale.
    2. Learning Time Offset Hours: This parameter defines the range of the rolling window used by the algorithm to
        learn its offset from the history of sensor data. Due to the exponential decay function, sensor data older than
        twice the learning time become almost insignificant. The default value is 12 h. We recommend setting this
        parameter to the same value as “Learning Time Gain Hours”.
    3. Learning Time Gain Hours: This parameter defines the range of the rolling window used by the algorithm to
        learn its gain from the history of sensor data. Due to the exponential decay function, sensor data older than
        twice the learning time become almost insignificant. The default value is 12 h. We recommend setting this
        parameter to the same value as “Learning Time Offset Hours”. In the case of indoor air quality monitoring, a
        time of 72h works optimal.
    4. Gating Max Duration Minutes: This parameter is referred to as the gating time, which is the time, at which the
        learning mechanism is deactivated after triggering a VOC event, when the VOC Index is above the gating
        threshold of 230. Without this feature, a high VOC event lasting for several minutes or longer would look like
        as if the event is already over because the VOC Index is decreasing again due to the learning. By using this
        feature, VOC events with a duration below the gating time will be displayed like they are. If an event takes
        longer than the gating time, it is considered a change in the environmental condition. The default value is set
        to 180 minutes. If only single events should be traced, it is recommended to set the value to zero, for portable
        applications it is recommended to perform individual tests.
    5. Standard Deviation Initial: This refers to the sensor behavior during the fast learning phase. Choosing high
        values reduces the gain of the learning algorithm but increases the device-to-device variation, low values
        increase the gain to VOC events in the initial learning but lower the device-to-device variation.
    6. Gain Factor: This parameter directly amplifies/attenuates the entire VOC Index output in both directions
        (fresh-air and VOC events) at the same time. Note: this parameter may interfere with the gating behavior. The
        gating threshold is fixed at VOC Index = 230 and thus, any event reaching this threshold will be treated
        according to the setting of the “Gating Max Duration Minutes” or, in case the VOC Index output is always
        below 230, the learning of offset and gain will always be active even during long VOC events.

Additionally, it is possible to apply the “Read/Write the VOC Algorithm State” function, which can be used to gain back
the original state of the algorithm after short power cycling of the device. This function reads/writes the whole learning
sequence to the memory, reproducing the initial value before power cycling to avoid the algorithm entering the fast-
learning phase again. In this way, the VOC Index output behaves approximately as if the sensor would not have been
shut down. The read function is recommended for power cycling times below 10 minutes and can only be applied if the
write function was triggered decently close before the shutdown. At default settings of the algorithm, we recommend
triggering the writing procedure every two hours.

www.sensirion.com                                Version 2 – D1 – June 2022                                          10/15
The response of the NOx Algorithm can also be tuned to specific applications by adjusting four different parameters,
like described for the VOC Algorithm. However, the two parameters ‘Learning Time Gain Hours’ and ‘Standard
Deviation Initial’ have no impact on the NOx Index output. Still, they must be set to the default values in the tuning
interface.

Tools
    ▪    SEN5x based prototype device

Documentation
   ▪ Datasheet
   ▪ Testing guides
           o VOC and NOx SGP41 Quick Testing Guide (sensirion.com)
   ▪ Documents:
           o What is Sensirion’s VOC/NOx Index?
           o What is the VOC Index?
           o What is the NOx Index?
   ▪ Repositories
           o Gas Index Algorithm: GitHub - Sensirion/gas-index-algorithm: Sensirion's Gas Index Algorithm
              provides a VOC and NOx Index output signal calculated from the SGP40/41 raw signals
Multiple iterations of the previously described processes are recommended to fine-tune the parameters in the testing
phase.
www.sensirion.com                                Version 2 – D1 – June 2022                                         11/15
V) Setting Up In-line Testing
Once the design iterations are finished and the product goes into production, in-line testing is another step towards
guaranteeing a stable quality of the final product. As all sensor components are tested at Sensirion production sites,
we recommend keeping the in-line testing procedure lean, examples for possible procedures are listed in this section.

Procedure
As the most important in-line testing procedure, we recommend the read device status register command for checking
functionality of all components and returns 0 for pass. As indicated previously testing specifications is a difficult, time-
consuming task which is why we recommend using the self-test command only.

If a functional test is absolutely required, we recommend generating brief “events” using bursts of ethanol for VOC or
smoke for particulate matter testing. If further testing is required, please contact Sensirion for further advice.

After specifying the performance of the final device, we advise to reiterate and adjust the mechanical and electrical
integration with respect to the fabrication processes in production to optimize performance and tune the design for the
desired behavior.

Documentation
   ▪ Datasheet
www.sensirion.com                                 Version 2 – D1 – June 2022                                            12/15
Revision History
Date                Version   Page(s)   Changes
January 2022        1         -         Initial version
June 2022           2         7         Updated operation modes flowchart
www.sensirion.com                       Version 2 – D1 – June 2022          13/15
Important Notices
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
www.sensirion.com                                  Version 2 – D1 – June 2022                                            14/15
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
www.sensirion.com                  Version 2 – D1 – June 2022                                    15/15

