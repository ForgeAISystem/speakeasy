# Transcription accuracy follow-up

Harsh confirmed the repaired indicator and paste path works, then reported inaccurate recognition. Moonshine Base is the current selected model. A choice of primary dictation languages was requested; until answered, English is the working assumption.

## Recommended next comparison

For English, try the existing Parakeet 0.6B v2 integration. NVIDIA describes it as an English model with punctuation, capitalization, and spoken-number support. Its published Open ASR average word error rate is 6.05%; Parakeet v3's corresponding published English average is 6.34%. V3 adds 25 European languages. These numbers are provider benchmark results, not measurements of Harsh's voice or this quantized CPU build. They do not establish that every individual will do better with v2.

Sources inspected 2026-09-06:

- [NVIDIA Parakeet v2 model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2)
- [NVIDIA Parakeet v3 model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
- [sherpa-onnx supported NeMo models and CPU setup](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/nemo-transducer-models.html)
- [OpenAI Whisper Turbo model card](https://huggingface.co/openai/whisper-large-v3-turbo)

Whisper Turbo is already integrated for broader multilingual use. Parakeet v3 does not cover Hindi or Gujarati. Confirm languages before choosing a multilingual default. Do not promise accent-specific accuracy from benchmark averages.

## Prepared on this Mac

The official sherpa-onnx int8 Parakeet v2 pack was downloaded through the existing model downloader into the normal local models directory. Moonshine files and user settings were retained. No app restart was performed for this model preparation.

The real TranscriberManager and Parakeet worker transcribed the generated 3.675625-second smoke sentence correctly before and after worker restart. Decode times were 81 ms and 80 ms; worker RSS snapshots after each decode were 1843 MiB. The Mac reports 48 GiB of physical memory. RSS snapshots are not peak or whole-app measurements; generated speech is not a user-accuracy benchmark. Evidence: verification/v2.4.2/engine-parakeet-v2-check.json.

Parakeet is prepared, but the active setting has not yet been changed. Native automation could navigate Settings but could not activate the advanced model controls reliably while the window was hidden/backgrounded. Do not silently rewrite the running app's settings file; it caches settings in memory. The normal in-app action is Settings, Voice models & optional AI cleanup, Parakeet 0.6B v2, Use.

## Acceptance

After selecting the candidate and waiting for Ready, compare three real sentences: conversational English, names/terms, and dates/numbers. Check the original recognized text in History to separate recognition errors from cleanup changes. Preserve privacy: no personal audio or transcript belongs in committed verification fixtures. If repeatable errors persist, inspect input-device choice and audio quality, then compare a second model using the same speech sample.
