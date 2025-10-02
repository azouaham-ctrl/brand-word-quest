import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordCriteria {
  fields: string[];
  lengthRange?: [number, number];
  firstLetter?: string;
  posType?: string;
  rarityRange?: [number, number];
  brandMode?: boolean;
  maxResults?: number;
}

interface WordResult {
  word: string;
  meta: {
    brand: number;
    rarity: number;
    sentiment: number;
    domain_available: boolean;
    domain_score: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const criteria: WordCriteria = await req.json();
    console.log('Processing word extraction with criteria:', criteria);

    // Fetch words from public sources
    const words = await fetchWordsFromSources(criteria.fields);
    
    // Filter based on criteria
    const filtered = filterWords(words, criteria);
    
    // Analyze with AI and score
    const analyzed = await analyzeWords(filtered, criteria);
    
    // Sort by score and limit results
    const maxResults = criteria.maxResults || 100;
    const results = analyzed
      .sort((a, b) => calculateScore(b.meta) - calculateScore(a.meta))
      .slice(0, maxResults);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in extract-words function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function fetchWordsFromSources(fields: string[]): Promise<string[]> {
  const sources: Record<string, string> = {
    "General English": "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
    "Medical / Health": "https://raw.githubusercontent.com/glutanimate/wordlist-medicalterms-en/master/wordlist.txt",
    "Technology / Computing": "https://raw.githubusercontent.com/imsky/wordlists/master/adjectives/technology.txt",
  };

  const allWords = new Set<string>();
  
  for (const field of fields) {
    const url = sources[field] || sources["General English"];
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const text = await response.text();
        const words = text.split('\n')
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length >= 3 && w.length <= 15 && /^[a-z]+$/.test(w));
        
        words.forEach(w => allWords.add(w));
      }
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error);
    }
  }

  return Array.from(allWords).slice(0, 5000); // Limit for performance
}

function filterWords(words: string[], criteria: WordCriteria): string[] {
  let filtered = words;

  // Length filter
  if (criteria.lengthRange) {
    const [min, max] = criteria.lengthRange;
    filtered = filtered.filter(w => w.length >= min && w.length <= max);
  }

  // First letter filter
  if (criteria.firstLetter) {
    const letter = criteria.firstLetter.toLowerCase();
    filtered = filtered.filter(w => w.startsWith(letter));
  }

  // Brand mode: exclude medical negative terms
  if (criteria.brandMode) {
    const negativeTerms = ['cancer', 'disease', 'pain', 'death', 'sick', 'ill'];
    filtered = filtered.filter(w => !negativeTerms.some(term => w.includes(term)));
  }

  return filtered.slice(0, 500); // Limit for AI analysis
}

async function analyzeWords(words: string[], criteria: WordCriteria): Promise<WordResult[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    // Fallback to simple scoring if no AI available
    return words.map(word => ({
      word,
      meta: {
        brand: calculateBrandScore(word),
        rarity: calculateRarityScore(word),
        sentiment: 0.5,
        domain_available: estimateDomainAvailability(word),
        domain_score: estimateDomainScore(word),
      }
    }));
  }

  const batches = chunkArray(words, 30);
  const allResults: WordResult[] = [];

  for (const batch of batches) {
    try {
      const prompt = `Analyze these words for branding potential (0-10 scale):
${batch.join(', ')}

For each word, consider:
1. Pronounceability (easy to say)
2. Memorability
3. Positive associations
4. Uniqueness (rarity)

Return JSON array: [{"word": "...", "brand": 0-10, "sentiment": -1 to 1, "rarity": 1-5}]`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a branding expert. Return valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '[]';
        
        try {
          const aiResults = JSON.parse(content);
          
          for (const result of aiResults) {
            if (result.word && typeof result.brand === 'number') {
              allResults.push({
                word: result.word,
                meta: {
                  brand: result.brand,
                  rarity: result.rarity || calculateRarityScore(result.word),
                  sentiment: result.sentiment || 0,
                  domain_available: estimateDomainAvailability(result.word),
                  domain_score: estimateDomainScore(result.word),
                }
              });
            }
          }
        } catch (parseError) {
          console.error('Error parsing AI response:', parseError);
          // Fallback to simple scoring for this batch
          batch.forEach(word => {
            allResults.push({
              word,
              meta: {
                brand: calculateBrandScore(word),
                rarity: calculateRarityScore(word),
                sentiment: 0.5,
                domain_available: estimateDomainAvailability(word),
                domain_score: estimateDomainScore(word),
              }
            });
          });
        }
      }
    } catch (error) {
      console.error('Error in AI analysis batch:', error);
    }
  }

  return allResults;
}

function calculateBrandScore(word: string): number {
  let score = 5.0;
  
  // Shorter is better for brands
  if (word.length <= 6) score += 2.0;
  else if (word.length <= 8) score += 1.0;
  else if (word.length > 10) score -= 1.0;
  
  // Check for positive fragments
  const positiveFragments = ['bright', 'smart', 'pure', 'fresh', 'vital', 'prime', 'max', 'ultra', 'pro'];
  if (positiveFragments.some(frag => word.includes(frag))) score += 1.5;
  
  // Penalize difficult letters
  const difficultLetters = ['q', 'x', 'z'];
  const difficultCount = word.split('').filter(c => difficultLetters.includes(c)).length;
  score -= difficultCount * 0.5;
  
  return Math.max(0, Math.min(10, score));
}

function calculateRarityScore(word: string): number {
  // Heuristic: longer words with uncommon letters are rarer
  let score = 1.0 + (word.length / 10.0);
  
  const uncommonLetters = ['j', 'q', 'x', 'z', 'k'];
  if (uncommonLetters.some(l => word.includes(l))) score += 1.0;
  
  return Math.max(1, Math.min(5, score));
}

function estimateDomainAvailability(word: string): boolean {
  // Common words are likely taken
  const commonWords = ['time', 'world', 'life', 'work', 'home', 'shop', 'data', 'tech', 'new', 'best'];
  if (commonWords.includes(word)) return false;
  
  // Short, pronounceable words are more likely available
  if (word.length >= 7 && word.length <= 12) return true;
  
  return word.length > 8;
}

function estimateDomainScore(word: string): number {
  let score = 0.5;
  
  if (word.length <= 8) score += 0.3;
  if (word.length > 12) score -= 0.2;
  
  // Heuristic boost for pronounceable patterns
  const vowels = word.split('').filter(c => 'aeiou'.includes(c)).length;
  const consonants = word.length - vowels;
  if (vowels > 0 && consonants > 0 && vowels / word.length > 0.25) {
    score += 0.2;
  }
  
  return Math.max(0, Math.min(1, score));
}

function calculateScore(meta: WordResult['meta']): number {
  return (
    meta.brand * 0.35 +
    meta.rarity * 2 * 0.20 +
    (meta.sentiment + 1) * 5 * 0.15 +
    meta.domain_score * 10 * 0.30
  );
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}