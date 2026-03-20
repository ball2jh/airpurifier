---
source: Info_Note_Output_MOX_Sensor.pdf
generated: 2026-03-20
---

Is it possible to map the output of a MOX sensor to a norm?

Learn why a MOX sensor output maps only under laboratory conditions to a norm

To measure tVOC, a sensor must be capable of measuring each individual VOC

tVOC stands for total volatile organic compounds. It is by definition the sum of all VOCs present in a given environment. Most health-related indoor air quality levels, such as those published by the German Federal Environmental Agency or the WHO, as well as building norms such as RESET or LEED, refer to tVOC. To measure this accurately, an analytical device is needed that can selectively quantify hundreds of VOCs individually at the same time, such as a gas chromatograph. These devices are large and expensive and are not suited for consumer devices such as indoor air quality monitors or air purifiers; however, they are state-of-the-art.

> In the lab, MOX sensors can be used with concentration outputs for the gas (mixture) they were calibrated for. In the field, MOX sensors are semiquantitative indicators (e.g., for VOCs), but not concentration detectors for tVOC.

Limitations of MOX technology

The MOX sensors which are currently available on the market (including Sensirion's SGP4x) can be calibrated for one specific gas or gas mixture in the laboratory. This allows a MOX sensor to accurately measure the concentration of the calibrated gas (mixture) in a controlled environment. However, the gas composition of VOCs in the field constantly and widely varies; therefore, all VOC compounds must be measured individually, as stated above. This means that an etVOC (where "e" stands for "equivalent") output from a MOX sensor may deviate from the true value by a factor of two (corresponding to −50/+100 %) or more. It also can happen that the sensor output moves in the opposite way compared to the true tVOC value. This behavior is called broadband sensitivity because the sensor is reacting to multiple gases at the same time, but cannot distinguish which gas is causing the signal change.

Furthermore, under field conditions it cannot be guaranteed that the reference gas conditions used for calibration (which is called baseline) are also exactly present in the field. This is necessary to compensate for the drift which almost every MOX sensor faces over time. This adds an additional, substantial error to the concentration readings. It is therefore important to understand that current MOX sensors can only work as semiquantitative VOC indicators, not as true tVOC detectors. The same arguments also are valid for the NOx output.

These facts also explain why etVOC concentration outputs from MOX sensors by different manufacturers often do not match.

The plot above shows a typical field situation for VOCs. Due to its nature, the etVOC output of a typical MOX sensor deviates significantly from the true tVOC concentration. Some events may even not be detected by the MOX sensor if it is not sensitive enough to this particular VOC.

Further reading: What is a metal oxide (MOX) sensor?
