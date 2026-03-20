---
source: GAS_AN_SGP4x_BuildingStandards_D1_1.pdf
generated: 2026-03-20
---

    Compliance of Sensirion’s VOC Sensors with Building
    Standards
    Related to All Sensirion Products with a VOC Index
    Output

    Preface
    Metal-oxide (MOX) gas sensors such as Sensirion’s SGP4x are a cost-efficient solution to continuously monitor
    indoor air quality. However, unlike the selective and quantitative measurements of a gas chromatograph
    coupled to a mass spectrometer (GC-MS), MOX sensors are limited to non-selective measurements of
    concentration ratios. Nonetheless, MOX sensors may fulfill the absolute TVOC concentration requirements of
    international building and health standards under defined conditions. These involve an equivalent
    concentration output, whose relation to the sensor’s raw signal is valid under laboratory conditions as defined
    by the sensor manufacturer. It is expected that absolute measurements in the field will deviate from the true
    TVOC concentration.

    This application note describes how Sensirion’s VOC Index in IAQ monitors can be used to comply with
    standards like RESET® Air1 and WELL Building Standard®2. First, the equivalence of the VOC Index to the
    ethanol concentration in parts per billion (ppb) under well-controlled laboratory conditions is established.
    Then the conversion of the ethanol concentration value to general TVOC in µg/m3 according to the respective
    building standards is provided. The laboratory tests do not need to be reproduced to comply with
    RESET® Air and WELL Building Standard®.
                                                                                     Scan me to provide feedback

1
    RESET® Air is a registered trademark of GIGA. https://www.reset.build/standard/air
2
    WELL Building Standard® is a registered trademark of the International WELL Building Institute. https://standard.wellcertified.com/well
www.sensirion.com / D1                                      Version 1 – March 2023                                                    1 / 11
Contents

1    Introduction to TVOC ........................................................................................................................................................................ 3
     1.1 TVOC definition......................................................................................................................................................................... 3
     1.2 TVOC in real life ........................................................................................................................................................................ 3
     1.3 Measuring VOCs ....................................................................................................................................................................... 4
              1.3.1        Gas Chromatography – Mass Spectrometry (GC-MS) ................................................................................ 4
              1.3.2        Metal Oxide Gas sensors (MOX) .......................................................................................................................... 4
2    Use of Sensirion’s VOC Index in building standards ............................................................................................................ 6
     2.1 Converting Sensirion’s VOC Index into TVOCethanol ppb output ............................................................................ 6
     2.2 Converting ethanol concentration into WELL Building Standard® compliant TVOC concentration ..... 7
     2.3 Converting ethanol concentration into RESET® Air compliant TVOC concentration .................................. 7
     2.4 Field data ..................................................................................................................................................................................... 8
     2.5 Accuracy of Sensirion’s VOC sensors, according to WELL Building Standard® requirements ................. 8
3    Revision History .................................................................................................................................................................................10
www.sensirion.com / D1                                                               Version 1 – March 2023                                                                                        2 / 11
1       Introduction to TVOC

1.1     TVOC definition
Volatile organic compounds (VOCs) are molecules which are commonly found in indoor air environments,
together with very volatile organic compounds (VVOCs) and semi-volatile organic compounds (SVOCs). The
sum of all concentrations of single VOCs corresponds to the total VOC (TVOC) concentration which is used as
an indication for contamination of indoor air.

TVOC is typically quantified either as a mass concentration in µg/m3 or as a molar concentration in parts per
billion (ppb). Typically, building standards define a safe threshold of average TVOCs in µg/m3.
1.2     TVOC in real life
Although many indoor VOCs are harmful chemicals found in paints, furniture, and plastics, some contributors
to TVOC can also be harmless and found in e.g. perfumes, food, and drinks. Assuming that the concentration
of each individual VOC in the air is known, the true TVOC concentration can be calculated. However, this
information does not reflect how harmful or harmless a specific TVOC concentration in a given indoor air
situation is. This can be visualized by an analogy to colored liquids contained in three buckets. Once mixed, it
is difficult to trace back the mixing ratio and the original color of each liquid, as shown in Figure 1:
Figure 1. Schematic representation of TVOC where color and amount of the liquid represent type and partial
pressure (concentrations) of VOCs respectively. While situations 1 and 2 have the same TVOC concentration,
in situation 1 the TVOC value is dominated by harmless ethanol, while in situation 2 the main contribution to
the same TVOC value comes from harmful toluene.

As an example, consider a 20 m2 (~200 sq. ft) room initially filled with clean air. A dinner lasting 1 to 2 hours
may increase the TVOC concentration by 10 ppm (Figure 1, situation 1). In this scenario, the high TVOC
concentration is predominantly driven by harmless ethanol. Alternatively, consider the same 20 m2 room
initially filled with clean air. An open can of oil paint may also increase the TVOC concentration by 10 ppm
(Figure 1, situation 2). In this scenario, the high TVOC concentration is predominantly driven by harmful toluene.
In both cases, the TVOC concentration cannot inform us about individual VOCs present in the air nor how
harmful a given situation is.

Distinguishing individual VOCs in indoor air would solve this problem. However, this is not a trivial task, as is
discussed in the next section.
www.sensirion.com / D1                          Version 1 – March 2023                                       3 / 11
1.3     Measuring VOCs

1.3.1 Gas Chromatography – Mass Spectrometry (GC-MS)
GC-MS measures the concentration of individual VOCs present in the air, typically in mass concentration units:
µg/m3. The atmosphere can be analyzed on-line and in real time, by placing large and expensive laboratory-
grade equipment in a room. For determining the TVOC level in a large number of rooms this is not
commercially viable. To get a snapshot of the TVOC level in a room, absorber tubes are typically positioned in
a room for a certain duration (typically hours). Then these tubes are sent to a specialized laboratory to perform
first separation of the adsorbed gases (by means GC) and then their quantification (by means of MS). In this
manner, GC-MS yields the exact amount for each constituent of the gas mixture collected during the exposure
time of the absorber. While the cost per measurement of this method is much lower than for the real-time GC-
MS analysis, and it is commonly performed during the commissioning of a new building, it is not a viable option
for continuous monitoring nor for time-resolved detection of VOC events.

Online or off-line GC-MS enables the exact quantification of individual VOCs present in the air, as schematically
represented in Figure 2.
Figure 2. Schematic representation of GC-MS measurements of a VOC mixture. Note that information about
type and concentration is still traceable, since GC-MS provides for each gas component an individual signal
output.

1.3.2               Metal Oxide Gas sensors (MOX)
Metal Oxide Gas sensors measure the presence of oxidizing and reducing gases in the air, typically in molar
concentration units: ppb. MOX sensors can continuously measure indoor VOCs, at low cost.

In short, the metal oxide material is exposed to indoor air, and the sensor electronically measures the presence
of reducing gases which are mainly VOCs. Measurements can be performed up to several times per second.

Continuous measurement of VOCs is essential to monitoring indoor air quality over time. As opposed to single
GC-MS measurements, MOX measurements enable the detection of events affecting indoor air quality.

However, VOC monitoring using MOX technology intrinsically has some disadvantages compared to GC-MS:
   • A MOX sensor has typically unknown and different selectivity towards individual VOCs. While it is
      more selective towards certain VOCs, it can hardly identify them, as shown in Figure 3.
   • A single MOX sensor generates a single, aggregate output for a VOC mixture. As a result, such MOX
      sensors cannot distinguish individual VOCs present in the air. This is schematically shown in Figure 4
      where the sensor observes the same gray color for two different gas mixtures in Variant 1 and 2.

www.sensirion.com / D1                          Version 1 – March 2023                                      4 / 11
Figure 3. Schematic representation of the varying selectivity of a MOX sensor towards different VOCs.

While the sensitivity to individual VOCs can be characterized in well-controlled laboratory experiments, in real
life MOX sensors typically provide a non-selective single output which is a sum of individual VOCs present in
the air measured with unknown and different selectivity, as schematically represented in Figure 4.
Figure 4. Representation of the non-selective single output of a MOX sensor exposed to a VOC mixture. Note
that information about type (color) and concentration (amount) of the individual VOCs is not comprehensible
anymore. Moreover, the TVOC value depends on the TVOC composition.

However, despite its above-mentioned limitations, MOX technology is an integral part of continuously
monitoring air quality as required by building standards and it is the only commercially viable option available
to date to continuously monitor indoor VOCs on a large scale. It yields immediate results and can easily be
implemented into consumer products. The real-time feedback provided by MOX sensors empowers end-users
to monitor their indoor air quality and assess the effectiveness of IAQ improvement measures.
www.sensirion.com / D1                         Version 1 – March 2023                                      5 / 11
2       Use of Sensirion’s VOC Index in building standards

2.1     Converting Sensirion’s VOC Index into TVOCethanol ppb output
Considering the non-selective single output of MOX sensors, Sensirion recommends the use of the VOC Index
as end-user output in IAQ devices. However, international building standards often rely on absolute TVOC
concentrations. A detailed procedure to convert the VOC Index into equivalent TVOC concentration, which is
only valid under laboratory conditions, is provided below. We recommend using the VOC Index algorithm
specific tuning parameters optimized for indoor air quality monitoring applications, see Table 1.

To convert the VOC Index into equivalent TVOC, Sensirion recommends using ethanol as calibration gas. To
train Sensirion’s VOC Algorithm, the pre-defined learning sequence under a controlled laboratory environment
shall be executed, as depicted in Figure 5 left. The data shown herein were collected with the tuning parameters
as stated in Table 1. This set of parameters is specifically suitable for IAQ monitors compliant with International
Building Standards and aiming at displaying both short-terms events and long-term trends over the course of
a few days to weeks.
Figure 5. Standard testing sequence (left) and the resulting correlation thereof between VOC Index and ethanol
concentration (right). This correlation can be further used as an approximation to convert VOC Index into
concentration of TVOC. Note: tuning parameters as summarized in Table 1 were used in this test.

                                                                          Specific Tuning
                                                  Default Tuning
Parameter                      Symbol                                      Parameters for             Unit
                                                   Parameters
                                                                         Building Standards
Average VOC Index               𝑥̅Index                  100                      -                     -
Normal learning
                                𝑡offset                   12                    720                     h
time offset
Normal learning
                                 𝑡gain                    12                      -                     h
time gain
Maximum gating
                                𝑡gating                  180                      -                   min
duration
Initial standard
                                𝜎initial                  50                      -                     -
deviation
Gain factor                      𝑓gain                   230                      -                     -
Table 1. Recommended parameter settings for the VOC Index algorithm when used in IAQ monitors compliant
with international building standards. The normal learning time offset is different from the default values and
should be set to 720 h to monitor trends on the timescale of weeks. Changing the normal learning time offset
does not affect the time needed by the sensor to meet specifications.

www.sensirion.com / D1                          Version 1 – March 2023                                        6 / 11
The use of ethanol as calibration gas (Figure 5 left) leads to a fixed relation between the VOC Index and ethanol
concentration (Figure 5 right), which is described in equation eq. 1:
                            TVOCEthanol [𝑝𝑝𝑏] = (ln(501 − 𝑉𝑂𝐶𝐼𝑛𝑑𝑒𝑥 ) − 6.24) ∙ (−381.97)                                        eq. 1

Where TVOCEthanol is the ethanol equivalent of TVOC and is proportional to any other equivalents of TVOC e.g.
to isobutylene as suggested by RESET® Air, or the Mølhave gas mixture3 used in the WELL Building Standard®.
In the following sections we provide the conversion factors between the TVOCEthanol derived from equation 1
to the TVOC equivalents used in building standards.
2.2     Converting ethanol concentration into WELL Building Standard® compliant TVOC
        concentration
According to the Performance Guidebook v.2 of the WELL Building Standard®4, performance of an IAQ monitor
can be assessed by using ethanol as calibration gas and the Mølhave gas mixture to convert the ethanol
concentration into the Mølhave equivalent of TVOC or TVOCMølhave . The conversion factor between
TVOCMølhave and TVOCEthanol has been determined by measuring the sensor’s response to the Mølhave gas
mixture, consisting of 22 VOCs commonly found in residential indoor environments3.

                                       TVOCMølhave [ppb] = 0.58 ∙ TVOCEthanol [ppb]                                              eq. 2
The TVOC concentration in μg/m3 is calculated from the TVOC concentration in ppb according to the WELL
Building Standard® guidelines, using equation 3:

                                     TVOCMølhave [μg⁄m3 ] = 4.5∙ TVOCMølhave [ppb]                                              eq. 3

In summary, the TVOC in μg/m3 is calculated from the VOC Index according to the WELL Building Standard®
guidelines, using equation 4:

                          TVOCMølhave [μg⁄m3 ] = (ln(501 − 𝑉𝑂𝐶𝐼𝑛𝑑𝑒𝑥 ) − 6.24) ∙ (−996.94)                                       eq. 4

Note: this approach is only a simplification since real indoor gas compositions may vary significantly over time
and from environment to environment.

2.3     Converting ethanol concentration into RESET® Air compliant TVOC concentration
According to the RESET® Air5 standard for Accredited Monitors, isobutylene can be used as a “middle ground”
to convert ppb into μg/m3 to assess the performance of an IAQ monitor, as shown in equation 5:

                                    TVOCIsobutylene [μg⁄m3 ] = 2.3∙ TVOCEthanol [ppb]                                           eq. 5

In summary, the TVOC in μg/m3 is calculated from the VOC Index according to the RESET® Air guidelines, using
equation 6:

                         TVOCIsobutylene [μg⁄m3 ] = (ln(501 − 𝑉𝑂𝐶𝐼𝑛𝑑𝑒𝑥 ) − 6.24) ∙ (−878.53)                                    eq. 6

Note: this approach is only a simplification since real indoor gas compositions may vary significantly over time
and from environment to environment.
3
  Mølhave L, Bach R, Pederson OF, Environ Int 12:167–175 (1986). https://doi.org/10.1016/0160-4120(86)90027-9
4
  WELL Building Standard® is a registered trademark of the International WELL Building Institute. https://standard.wellcertified.com/well
5
  RESET® Air is a registered trademark of GIGA. https://www.reset.build/standard/air
www.sensirion.com / D1                                    Version 1 – March 2023                                                    7 / 11
2.4 Field data
Field data of Sensirion’s VOC Index (left) over one month and the corresponding TVOCIsobutylene and
TVOCMølhave concentration according to RESET® Air and WELL Building Standard® (right) are shown in Figure
6.
Figure 6. VOC Index (left) and corresponding TVOCIsobutylene and TVOCMølhave concentration outputs
according to RESET® Air and WELL Building Standard®, respectively (right).
2.5     Accuracy of Sensirion’s VOC sensors, according to WELL Building Standard®
        requirements
WELL Building Standard® has accuracy requirements for continuously monitoring sensors6. The accuracy of
Sensirion’s VOC sensor in building environments is estimated by exposing the sensors to the varying VOC
concentrations and recording their performance. The laboratory conditions presented in Section 2.1 can be
used to perform this test.
Figure 7. Repeated measurement of 30 sensors under the laboratory conditions presented in Section 2.1 (left).
The corresponding device-to-device variation (D2D) is reported as a function of the Mølhave concentration.

The device-to-device variation (D2D) of Sensirion’s sensors lies within ±10 VOC Index points in the range 0 to
500 µg/m3, as reported in Figure 7. From these measurements, the accuracy of Sensirion’s VOC sensors can be
generated as a function of Mølhave VOC gas mixture using eq. 4, as reported in Figure 8.
6
 WELL Performance Verification Guidebook, version Q4 2022. https://a.storyblok.com/f/52232/x/0364a6b272/well-performance-
verification-guidebook_q4-2022_final.pdf
www.sensirion.com / D1                                Version 1 – March 2023                                                8 / 11
Figure 8. Accuracy of Sensirion’s sensors, as a function of TVOC Mølhave concentration (green). The error is
within the maximum allowed error according to the WELL Building Standard (± 20 µg/m3 + 15% measured
value).

The accuracy of Sensirion’s VOC sensors lies within the requirements of the WELL Building Standard®, as shown
in Figure 8.
www.sensirion.com / D1                        Version 1 – March 2023                                     9 / 11
3       Revision History
Date                     Version   Pages                              Changes
29 (March 2023)            1.0      all                             Initial version
                                                              Preface modification
19 (September 2023)        1.1      all        Correction of maximum gating duration Section 2.1
                                                            Addendum of Section 2.5
www.sensirion.com / D1                     Version 1 – March 2023                                  10 / 11
Important Notices
Warning, Personal Injury

Do not use this product as safety or emergency stop devices or in any other application where failure of the product could
result in personal injury. Do not use this product for applications other than its intended and authorized use. Before installing,
handling, using or servicing this product, please consult the data sheet and application notes. Failure to comply with these
instructions could result in death or serious injury.

If the Buyer shall purchase or use SENSIRION products for any unintended or unauthorized application, Buyer shall defend,
indemnify and hold harmless SENSIRION and its officers, employees, subsidiaries, affiliates and distributors against all claims, costs,
damages and expenses, and reasonable attorney fees arising out of, directly or indirectly, any claim of personal injury or death
associated with such unintended or unauthorized use, even if SENSIRION shall be allegedly negligent with respect to the design
or the manufacture of the product.

ESD Precautions
The inherent design of this component causes it to be sensitive to electrostatic discharge (ESD). To prevent ESD-induced damage
and/or degradation, take customary and statutory ESD precautions when handling this product. See application note “ESD, Latchup
and EMC” for more information.

Warranty
SENSIRION warrants solely to the original purchaser of this product for a period of 12 months (one year) from the date of delivery
that this product shall be of the quality, material and workmanship defined in SENSIRION’s published specifications of the product.
Within such period, if proven to be defective, SENSIRION shall repair and/or replace this product, in SENSIRION’s discretion, free
of charge to the Buyer, provided that:
•     notice in writing describing the defects shall be given to SENSIRION within fourteen (14) days after their appearance;
•     such defects shall be found, to SENSIRION’s reasonable satisfaction, to have arisen from SENSIRION’s faulty design, material,
      or workmanship;
•     the defective product shall be returned to SENSIRION’s factory at the Buyer’s expense; and
•     the warranty period for any repaired or replaced product shall be limited to the unexpired portion of the original period.
This warranty does not apply to any equipment which has not been installed and used within the specifications recommended by
SENSIRION for the intended and proper use of the equipment. EXCEPT FOR THE WARRANTIES EXPRESSLY SET FORTH HEREIN,
SENSIRION MAKES NO WARRANTIES, EITHER EXPRESS OR IMPLIED, WITH RESPECT TO THE PRODUCT. ANY AND ALL
WARRANTIES, INCLUDING WITHOUT LIMITATION, WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR
PURPOSE, ARE EXPRESSLY EXCLUDED AND DECLINED.
SENSIRION is only liable for defects of this product arising under the conditions of operation provided for in the data sheet and
proper use of the goods. SENSIRION explicitly disclaims all warranties, express or implied, for any period during which the goods
are operated or stored not in accordance with the technical specifications.
SENSIRION does not assume any liability arising out of any application or use of any product or circuit and specifically disclaims
any and all liability, including without limitation consequential or incidental damages. All operating parameters, including without
limitation recommended parameters, must be validated for each customer’s applications by customer’s technical experts.
Recommended parameters can and do vary in different applications.
SENSIRION reserves the right, without further notice, (i) to change the product specifications and/or the information in this
document and (ii) to improve reliability, functions and design of this product.
Headquarters and Subsidiaries

 Sensirion AG                                   Sensirion Inc., USA                            Sensirion Korea Co. Ltd.
 Laubisruetistr. 50                             phone: +1 312 690 5858                         phone: +82 31 337 7700~3
 CH-8712 Staefa ZH                              info-us@sensirion.com                          info-kr@sensirion.com
 Switzerland                                    www.sensirion.com                              www.sensirion.com/kr

 phone: +41 44 306 40 00                        Sensirion Japan Co. Ltd.                       Sensirion China Co. Ltd.
 fax:    +41 44 306 40 30                       phone: +81 45 270 4506                         phone: +86 755 8252 1501
 info@sensirion.com                             info-jp@sensirion.com                          info-cn@sensirion.com
 www.sensirion.com                              www.sensirion.com/jp                           www.sensirion.com/cn

 Sensirion Taiwan Co. Ltd
 phone: +886 2 2218-6779
 info@sensirion.com                             To find your local representative, please visit
 www.sensirion.com                              www.sensirion.com/distributors

                   Copyright © 2022, by SENSIRION. CMOSens® is a trademark of Sensirion. All rights reserved
www.sensirion.com / D1                                      Version 1 – March 2023                                                        11 / 11

