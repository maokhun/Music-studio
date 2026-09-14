/**
 * Built-in intelligent Khmer & Multilingual lyrics structuring engine
 */

interface LyricsTemplate {
  title: string;
  genre: string;
  verse1: string[];
  chorus: string[];
  verse2: string[];
  bridge: string[];
  outro: string[];
}

const KHMER_LYRICS_DB: Record<string, LyricsTemplate> = {
  romantic: {
    title: 'ស្នេហ៍ក្នុងក្តីស្រមៃ (Dream Love)',
    genre: 'Slow Romantic Pop',
    verse1: [
      '[Verse 1]',
      'សម្លឹងមើលទៅមេឃ ឃើញផ្កាយភ្លឺចែងចាំង',
      'ក្នុងចិត្តនឹកដល់អូន គ្រប់ពេលវេលា',
      'ទោះបីជាផ្លូវឆ្ងាយ ក៏បេះដូងនៅក្បែរ',
      'មិនដែលប្រែប្រួល ស្នេហ៍តែរូបអូន។'
    ],
    chorus: [
      '[Chorus]',
      'ស្នេហាពិតប្រាកដ មានតែអូនម្នាក់គត់',
      'សូមសន្យានឹងគ្នា ថែរក្សាជារៀងរហូត',
      'ទោះមានព្យុះភ្លៀង ក៏មិនបោះបង់',
      'កាន់ដៃគ្នាឆ្លង ទៅដល់ត្រើយសុភមង្គល។'
    ],
    verse2: [
      '[Verse 2]',
      'រាល់ពេលបានក្បែរអូន ដូចពិភពលោកស្រស់បំព្រង',
      'ស្នាមញញឹមមួយនោះ ធ្វើឱ្យចិត្តកក់ក្តៅ',
      'គ្មានអ្វីប្រៀបស្មើ ក្តីស្រលាញ់ស្មោះសរ',
      'ដែលអូនបានផ្តល់ ឱ្យរូបបងឡើយ។'
    ],
    bridge: [
      '[Bridge]',
      'ពេលវេលាកន្លង ស្នេហានៅដដែល',
      'ចិត្តមួយថ្លើមមួយ រួមរស់ជួបជុំ...'
    ],
    outro: [
      '[Outro]',
      'ស្រលាញ់អូនរហូត... ជារៀងរហូត...',
      'ស្នេហ៍ក្នុងក្តីស្រមៃ...'
    ]
  },
  kantrum: {
    title: 'រាំកន្ទ្រឹមសប្បាយ (Happy Kantrum)',
    genre: 'Kantrum Remix',
    verse1: [
      '[Verse 1]',
      'តោះបងប្អូនអើយ មកនាំគ្នារាំលេង',
      'ឮសូរស្គរដៃ ញាក់កន្ទ្រាក់អារម្មណ៍',
      'រាំលេងចូលឆ្នាំ រីករាយគ្រប់ៗគ្នា',
      'ចោលទុក្ខកង្វល់ មកសប្បាយទាំងអស់គ្នា!'
    ],
    chorus: [
      '[Chorus]',
      'កន្ទ្រឹមញាក់សប្បាយ អើយរាំកន្ទ្រឹម!',
      'ស្រីៗស្អាតៗ រាំរាក់ទាក់ញញឹម',
      'លើកដៃឡើងលើ ញាក់ចង្កេះតាមចង្វាក់',
      'សប្បាយណាស់បងប្អូនអើយ រាំលេងទាំងអស់គ្នា!'
    ],
    verse2: [
      '[Verse 2]',
      'ភ្លេងលាន់រណ្តំ ទ្រសោបន្លឺសំឡេង',
      'ក្មេងចាស់ប្រុសស្រី នាំគ្នារាំកម្សាន្ត',
      'ភូមិឋានរីករាយ សើចក្អាកក្អាយពេញភូមិ',
      'ឆ្នាំថ្មីសិរីសួស្តី មានលាភមានជ័យ!'
    ],
    bridge: [
      '[Bridge]',
      'ញាក់មួយៗ... ញាក់មួយៗ...',
      'តោះៗរាំទាំងអស់គ្នា!'
    ],
    outro: [
      '[Outro]',
      'សប្បាយណាស់អើយ... រាំកន្ទ្រឹមខ្មែរយើង!',
      '(Music Fade Out)'
    ]
  },
  breakup: {
    title: 'ទឹកភ្នែកពេលបែកគ្នា (Tears of Goodbye)',
    genre: 'Emotional Rock Ballad',
    verse1: [
      '[Verse 1]',
      'ភ្លៀងធ្លាក់មកហើយ ស្របពេលអូនចាកចេញ',
      'ពាក្យលាខ្លីមួយម៉ាត់ បន្សល់ភាពឈឺចាប់',
      'បងដឹងថាខ្លួនឯង មិនល្អគ្រប់គ្រាន់',
      'ទើបអូនសម្រេចចិត្ត ដើរចេញពីបង។'
    ],
    chorus: [
      '[Chorus]',
      'ទឹកភ្នែកហូរស្រក់ ព្រោះនឹកអូនខ្លាំងពេក',
      'យប់នេះគ្មានអូន ដេកឈឺផ្សាក្នុងទ្រូង',
      'តើឱ្យបងរស់នៅ យ៉ាងណាបន្តទៅទៀត?',
      'ពេលបេះដូងមួយនេះ នៅតែស្រលាញ់អូន...'
    ],
    verse2: [
      '[Verse 2]',
      'រូបថតចាស់ៗ នៅតែដាក់លើតុ',
      'រាល់កន្លែងធ្លាប់ទៅ នៅចាំស្នាមញញឹម',
      'ឥឡូវនៅសល់តែ អនុស្សាវរីយ៍ជូរចត់',
      'ដែលដុតរោលបេះដូង ឱ្យឈឺចាប់រាល់ថ្ងៃ។'
    ],
    bridge: [
      '[Guitar Solo]',
      'សូមឱ្យអូនជួបមនុស្សល្អ... កុំឱ្យឈឺចាប់ដូចបង...',
      'លាហើយស្នេហាដំបូង...'
    ],
    outro: [
      '[Outro]',
      'លាហើយ... មនុស្សដែលបងធ្លាប់ស្រលាញ់...',
      'ទឹកភ្នែកពេលបែកគ្នា...'
    ]
  }
};

export function generateSmartLyrics(topic: string, styleId?: string): { title: string; lyrics: string; style: string } {
  let matched = KHMER_LYRICS_DB.romantic;
  
  const lower = (topic + ' ' + (styleId || '')).toLowerCase();
  if (lower.includes('កន្ទ្រឹម') || lower.includes('remix') || lower.includes('dance') || lower.includes('ញាក់')) {
    matched = KHMER_LYRICS_DB.kantrum;
  } else if (lower.includes('ឈឺ') || lower.includes('បែក') || lower.includes('rock') || lower.includes('ទឹកភ្នែក') || lower.includes('sad')) {
    matched = KHMER_LYRICS_DB.breakup;
  }

  const formattedLyrics = [
    ...matched.verse1,
    '',
    ...matched.chorus,
    '',
    ...matched.verse2,
    '',
    ...matched.bridge,
    '',
    ...matched.chorus,
    '',
    ...matched.outro
  ].join('\n');

  return {
    title: matched.title,
    lyrics: formattedLyrics,
    style: matched.genre
  };
}
