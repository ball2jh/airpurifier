---
source: Info_Note_MOX_sensor.pdf
generated: 2026-03-20
---

What is a metal oxide (MOX) sensor?
Learn about the possibilities and limitations of MOX sensors and the strength of Sensirion's SGP4x products

A MOX sensor reacts to most changes in gas composition

In a nutshell, a MOX sensor is a heated surface of a metal oxide that changes its electrical resistance depending on the oxygen content on its surface. Oxidizing gases like NOx (providing more oxygen than ambient air) increase the resistance, whereas reducing gases like VOCs (consuming oxygen by being combusted on the metal oxide surface) reduce the resistance. Humidity also impacts the MOX sensor signal, as water vapor usually behaves as a reducing gas. This can be compensated for by using a humidity sensor such as Sensirion's SHTxx. Sensirion's SGP4x sensors feature on-chip humidity compensation.

> MOX sensors are excellent devices to detect relatively short-term changes in gas compositions and better understand the activities associated with gas events in indoor environments.

MOX sensors are semiquantitative and broadband-sensitive

By calibrating the MOX resistance to a specific target gas, under laboratory conditions the absolute concentration of the target gas in air can be measured. However, under field conditions, two aspects hamper MOX sensors' ability to provide absolute concentration outputs.

Firstly, a well-defined baseline is required. A baseline is a reference point for a well-known concentration of the target gas. Since the signal of a MOX sensor usually drifts over time, this must be compensated for in the field. However, under field conditions, it cannot be ensured that the sensor is exposed to the exact same concentration it has been calibrated for, leading to an erroneous concentration output.

Secondly, a MOX sensor is a broadband-sensitive device, meaning that it reacts to multiple gases and cannot distinguish between them. Thus, calibrating such a sensor to a specific gas or gas mixture – as it is usually the case with digital MOX sensors – does not make these devices selective to this particular gas (mixture). For instance, a calibrated sensor could show 1000 ppb as the output, whether it is related to 500 ppb of ethanol or 2000 ppb of toluene. However, through material design and operation mode engineering, it is possible to enhance the selectivity to specific gas groups – namely, reducing and oxidizing gases – to distinguish between VOC and NOx events, as it was done with Sensirion's SGP41.

Nevertheless, because MOX sensors are sensitive and fast, they can reliably report short-term changes in the gas composition relative to a certain period in history (e.g., the past 24 hours).

Further reading
What are reducing gases?
What are oxidizing gases?
