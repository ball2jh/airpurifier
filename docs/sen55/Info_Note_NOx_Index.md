---
source: Info_Note_NOx_Index.pdf
generated: 2026-03-20
---

What is Sensirion's NOx Index?
Learn about the benefits of using the NOx Index as Sensirion's standard output for NOx measurements

The NOx Index is the optimal tool to monitor NOx conditions. Instead of concentration output, which cannot be properly provided under field conditions, the NOx Index much better exploits the capabilities of a MOX sensor by being sensitive towards oxidizing gases. For this, the raw signal of the SGP41's NOx pixel is processed by Sensirion's powerful Gas Index Algorithm on an external microcontroller. The NOx Index describes the current NOx condition in a room relative to the sensor's recent history. In this way, the NOx Index behaves like a human nose. Assuming that we are entering a room from outside, our nose will take the air composition outside the room as an offset (baseline) and provide us with feedback if it recognizes higher or lower levels of gases when entering the room. The NOx Index performs similarly by applying a moving average over the past 24 hours (called the learning time).

> The NOx Index mimics the human nose's perception of odors with a relative intensity compared to recent history. In combination with the VOC Index, it helps to distinguish different events and user activities.

This is a very helpful feature because the NOx Index thus works in any environment. On the NOx Index scale, this offset is always mapped to the value of 1, making the readout as easy as possible: an NOx Index above 1 means that there are more NOx compounds compared to the average (e.g., induced by cooking on a gas stove), while an NOx Index close to 1 means that there are (nearly) no NOx gases present, which is the case most of the time (or induced by fresh air from an open window, using an air purifier, etc.).

Also, our nose perceives odors on a scale of relative intensity (weak, distinct and strong), but it cannot tell us if the concentration of one odor is truly higher than the concentration of another. Therefore, all NOx events are quantified on the same limited scale of the NOx Index, ranging from 1 to 500. In contrast to the VOC Index, there is no gain adaptation for the NOx Index because the gas composition of NOx events usually does not vary as much as in VOC events. The NOx Index scale enables a fixed mapping of the NOx Index to an action that a device should execute (e.g., triggering an air purifier when the NOx Index is above 20).

The figure at the top demonstrates a possible example implementation of the NOx Index in an air purifier. At the bottom, one can see a typical activity profile in a kitchen for which the simultaneous monitoring of VOC and NOx Indices helps distinguishing different types of events.

Further reading: What is Sensirion's NOx Index? More about Gas Index Algorithm and its tunability: Sensirion's VOC and NOx Indices for Indoor Air Applications (upon request)
