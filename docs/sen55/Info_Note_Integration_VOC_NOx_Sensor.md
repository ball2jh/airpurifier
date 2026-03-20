---
source: Info_Note_Integration_VOC_NOx_Sensor.pdf
generated: 2026-03-20
---

How can I integrate Sensirion's VOC and/or NOx sensors into my air purifier?

Learn about the easy integration of Sensirion's VOC and NOx feature into air purifiers

VOC and NOx Index signals are ready to be used with air purifiers. Sensirion's VOC and NOx Indices enable air purifiers to automatically react to VOC and NOx events, thus improving safety and comfort and saving energy and costs for the end-user. Both signals can be used to regulate the fan of an air purifier to flush polluted air through the gas filters. The figure above provides an example for discrete steps of the fan's power. Please note that the average of the VOC status is mapped to a VOC Index of 100, while the average of the NOx status is mapped to a NOx Index of 1. Therefore, it makes sense to apply a different assignment between fan power and the two indices. It is also possible to use a continuous regulation linked to the indices. The Gas Index Algorithm offers multiple possibilities for tuning the signal behavior to ensure optimal user experience. As a starting point, Sensirion recommends using the default settings.

Sensirion's VOC and NOx Index signals are optimized for easy integration into air purifier applications, facilitating the design-in process for customers.

Share the information of the gas conditions with your end-user. The efficiency of the air purifier device can be nicely demonstrated by visualizing the collected sensor data for the end-user. To achieve this, one could show the VOC and NOx Index plots, for example, colored according to the levels (like the mapping for the fan power), which indicates the relative intensity of gas events. Or one could use a more abstract visualization, especially if there are limited capabilities of the display, for example, a traffic light indicator without numbers or stacked bars where each bar represents one level. Such information will better inform the end-users about indoor air quality and enable them to identify and possibly remove sources of VOCs and NOx.

> Here, two possible ways of visualizing VOC and NOx Indices to the end user of air purifiers are demonstrated. Top: VOC/NOx Index as time trace colored according to the mapping of the fan power. Bottom: stacked bars for which each of the bars represents a level according to the mapping of the fan power.

Benefit from Sensirion's different options to add both VOC and NOx features. The easiest way in terms of integrating the VOC and NOx Indices into an air purifier is to use the plug-and-play SEN5x combo module. It directly provides the two gas indices through the module's interface. Open-source drivers for these modules can be found on Sensirion's github webpage. If you prefer to purchase components, Sensirion offers both component drivers and the Gas Index Algorithm, which processes the SGP4x raw signals into the VOC and NOx Indices, as open-source packages on github.

Further reading and software

More about Gas Index Algorithm and its tunability: Sensirion's VOC and NOx Indices for Indoor Air Applications (upon request)

Drivers for SEN5x

Drivers for SGP4x

Gas Index Algorithm
