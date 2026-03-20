---
source: Info_Note_VOC_Index.pdf
generated: 2026-03-20
---

What is Sensirion's VOC Index?
Learn about the benefits of using the VOC Index as Sensirion's standard output for VOC measurements

The VOC Index is the optimal tool to monitor VOC conditions. Instead of etVOC concentration output, which cannot be properly provided under field conditions, the VOC Index utilizes the capabilities of a MOX sensor much more effectively. To achieve this, the raw signal of the SGP4x's VOC pixel is processed by Sensirion's powerful Gas Index Algorithm on an external microcontroller. The VOC Index describes the current VOC status in a room relative to the sensor's recent history. In this way, the VOC Index behaves like a human nose.

Assuming that we are entering a room from outside, our nose will use the air composition outside the room as an offset (baseline) and provide us with feedback if it recognizes higher or lower levels of VOCs when entering the room. The VOC Index performs a similar calculation by using a moving average over the past 24 hours (called the "learning time") as offset.

> The VOC Index mimics the human nose's perception of odors with a relative intensity compared to recent history. The VOC Index is also sensitive to odorless VOCs, but it cannot discriminate between them.

This is a very helpful feature because the VOC Index thus works in any environment regardless of their different VOC backgrounds. Note that every indoor air environment contains a certain VOC background stemming from constantly off-gassing sources. On the VOC Index scale, this offset is always mapped to the value of 100, making the readout as easy as possible: a VOC Index above 100 means that there are more VOCs compared to the average (e.g., induced by a VOC event from cooking, cleaning, breathing, etc.) while a VOC Index below 100 means that there are fewer VOCs compared to the average (e.g., induced by fresh air from an open window, using an air purifier, etc.).

Also, our nose perceives odors on a scale of relative intensity (weak, distinct and strong), but it cannot tell us if the concentration of one odor is truly higher than the concentration of another. Therefore, the VOC Index adapts its gain according to the VOC events of the past 24-hours learning time, leading to different VOC conditions being quantified on the same limited scale: a VOC Index ranging from 1 to 500. In this way, one can use a fixed mapping of the VOC Index to an action the device should execute (for instance, triggering an air purifier when the VOC Index is above 150). Let's assume that in one room an air purifier is exposed to VOC events which the SGP4x is not very sensitive towards, but it is still desired that the air purifier automatically starts cleaning the room. The gain adaption of the VOC Index helps to boost the signal so the air purifier can detect these events and take action.

*The figure above demonstrates a possible example implementation of the VOC Index in an air purifier.*

Further reading
What are reducing gases?
More about Gas Index Algorithm and its tunability: Sensirion's VOC and NOx Indices for Indoor Air Applications (upon request)
