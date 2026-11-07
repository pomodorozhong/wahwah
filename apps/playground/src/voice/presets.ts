import { type VoiceSettings } from 'wahwah';

/** A preset is a phrase plus the voice settings it was written for. */
export interface Preset {
  id: string;
  name: string;
  phonemes: string;
  voice: VoiceSettings;
}

// Invented words in ARPABET. Inline klattsch directives (pitch deltas such as
// `AA(+30)`) are allowed and are kept as part of the phrase.
export const PRESETS: Preset[] = [
  {
    id: 'greeting',
    name: 'Friendly greeting',
    phonemes: 'HH EH L OW , M IY B AA DH UW . K AA L IY M OW Z AA',
    voice: { pitchHz: 130, msPerPhoneme: 105, formantScale: 1 },
  },
  {
    id: 'question',
    name: 'Curious question',
    phonemes: 'W UW M AA L EY , T IY N OW(+40) SH UW(+60)',
    voice: { pitchHz: 150, msPerPhoneme: 115, formantScale: 1.05 },
  },
  {
    id: 'grumble',
    name: 'Grumpy mumble',
    phonemes: 'M AH M B UH R G AH N , DH OW B UW R . M M AA(-20)',
    voice: { pitchHz: 85, msPerPhoneme: 140, formantScale: 0.92 },
  },
  {
    id: 'chatter',
    name: 'Excited chatter',
    phonemes: 'P IY K AA T IY K AA , Y AE Y AE B IY D OW B IY(+50)',
    voice: { pitchHz: 210, msPerPhoneme: 75, formantScale: 1.15 },
  },
  {
    id: 'lips',
    name: 'Lip workout (diagnostic)',
    phonemes: 'AA IY UW , AA IY UW , M AA M W IY',
    voice: { pitchHz: 120, msPerPhoneme: 220, formantScale: 1 },
  },
];
