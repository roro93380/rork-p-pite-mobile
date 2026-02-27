import { Pepite } from '@/types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface ExtractedAd {
  id: string;
  title: string;
  price: number;
  url: string;
  imageUrl: string;
  description?: string;
}

const UNSPLASH_IMAGES: Record<string, string> = {
  watch: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&h=600&fit=crop',
  handbag: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop',
  sneakers: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop',
  camera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=600&fit=crop',
  vintage: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=600&fit=crop',
  electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=600&fit=crop',
  jewelry: 'https://images.unsplash.com/photo-1515562141589-67f0d569b6c2?w=600&h=600&fit=crop',
  furniture: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop',
  art: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=600&fit=crop',
  gaming: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?w=600&h=600&fit=crop',
  vinyl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=600&h=600&fit=crop',
  clothing: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
  shoes: 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600&h=600&fit=crop',
  bike: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&h=600&fit=crop',
  book: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=600&fit=crop',
  bag: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop',
  console: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600&h=600&fit=crop',
  phone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=600&fit=crop',
  default: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
};

function getImageForQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  for (const [key, url] of Object.entries(UNSPLASH_IMAGES)) {
    if (lowerQuery.includes(key)) {
      return url;
    }
  }
  const keys = Object.keys(UNSPLASH_IMAGES).filter(k => k !== 'default');
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return UNSPLASH_IMAGES[randomKey] ?? UNSPLASH_IMAGES.default;
}

export function getAdExtractionScript(): string {
  return `
(function() {
  try {
    var ads = [];
    var seen = {};
    var host = window.location.hostname.toLowerCase();

    function cleanPrice(text) {
      if (!text) return 0;
      var cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.');
      var val = parseFloat(cleaned);
      return isNaN(val) ? 0 : val;
    }

    function getAbsUrl(rel) {
      if (!rel) return '';
      if (rel.startsWith('http')) return rel;
      try { return new URL(rel, window.location.origin).href; } catch(e) { return ''; }
    }

    // Vinted
    if (host.includes('vinted')) {
      var vintedCards = document.querySelectorAll('[data-testid*="item"], .feed-grid__item, .ItemBox_overlay__jCRMi, a[href*="/items/"]');
      vintedCards.forEach(function(card) {
        var link = card.tagName === 'A' ? card : card.querySelector('a[href*="/items/"]');
        var url = link ? getAbsUrl(link.getAttribute('href')) : '';
        var titleEl = card.querySelector('[data-testid*="description"], .web_ui__Text__text, p, h2, .ItemBox_title__anuEt');
        var title = titleEl ? titleEl.textContent.trim() : '';
        var priceEl = card.querySelector('[data-testid*="price"], .web_ui__Text__bold, .ItemBox_price__ckKgn');
        var price = priceEl ? cleanPrice(priceEl.textContent) : 0;
        var imgEl = card.querySelector('img[src*="vinted"], img');
        var img = imgEl ? getAbsUrl(imgEl.getAttribute('src')) : '';
        if (title && price > 0 && !seen[url || title]) {
          seen[url || title] = true;
          ads.push({ title: title.substring(0, 120), price: price, url: url, imageUrl: img });
        }
      });
    }

    // LeBonCoin
    if (host.includes('leboncoin')) {
      var lbcCards = document.querySelectorAll('[data-test-id="ad"], a[href*="/ad/"], .styles_adCard__', '.AdCard_adCardLink__');
      lbcCards.forEach(function(card) {
        var link = card.tagName === 'A' ? card : card.querySelector('a[href*="/ad/"]');
        var url = link ? getAbsUrl(link.getAttribute('href')) : '';
        var titleEl = card.querySelector('[data-test-id="ad-subject"], p[data-qa-id="aditem_title"], h2, .AdCard_title__');
        var title = titleEl ? titleEl.textContent.trim() : '';
        var priceEl = card.querySelector('[data-test-id="price"], span[data-qa-id="aditem_price"], .AdCard_price__');
        var price = priceEl ? cleanPrice(priceEl.textContent) : 0;
        var imgEl = card.querySelector('img');
        var img = imgEl ? getAbsUrl(imgEl.getAttribute('src')) : '';
        if (title && price > 0 && !seen[url || title]) {
          seen[url || title] = true;
          ads.push({ title: title.substring(0, 120), price: price, url: url, imageUrl: img });
        }
      });
    }

    // eBay
    if (host.includes('ebay')) {
      var ebayCards = document.querySelectorAll('.s-item, .srp-results .s-item__wrapper');
      ebayCards.forEach(function(card) {
        var link = card.querySelector('a.s-item__link, a[href*="/itm/"]');
        var url = link ? getAbsUrl(link.getAttribute('href')) : '';
        var titleEl = card.querySelector('.s-item__title, h3');
        var title = titleEl ? titleEl.textContent.trim() : '';
        var priceEl = card.querySelector('.s-item__price');
        var price = priceEl ? cleanPrice(priceEl.textContent) : 0;
        var imgEl = card.querySelector('img');
        var img = imgEl ? getAbsUrl(imgEl.getAttribute('src')) : '';
        if (title && price > 0 && !seen[url || title] && !title.includes('Shop on eBay')) {
          seen[url || title] = true;
          ads.push({ title: title.substring(0, 120), price: price, url: url, imageUrl: img });
        }
      });
    }

    // Facebook Marketplace
    if (host.includes('facebook')) {
      var fbCards = document.querySelectorAll('a[href*="/marketplace/item/"]');
      fbCards.forEach(function(card) {
        var url = getAbsUrl(card.getAttribute('href'));
        var texts = card.querySelectorAll('span');
        var title = '';
        var price = 0;
        texts.forEach(function(t) {
          var txt = t.textContent.trim();
          if (!title && txt.length > 5 && txt.length < 150 && !txt.match(/^[0-9.,\\s€$£]+$/)) title = txt;
          if (!price && txt.match(/[0-9]+\\s*€/)) price = cleanPrice(txt);
        });
        var imgEl = card.querySelector('img');
        var img = imgEl ? getAbsUrl(imgEl.getAttribute('src')) : '';
        if (title && price > 0 && !seen[url || title]) {
          seen[url || title] = true;
          ads.push({ title: title.substring(0, 120), price: price, url: url, imageUrl: img });
        }
      });
    }

    // Generic fallback for any other site
    if (ads.length === 0) {
      var allLinks = document.querySelectorAll('a[href]');
      allLinks.forEach(function(a) {
        var url = getAbsUrl(a.getAttribute('href'));
        var priceMatch = a.textContent.match(/([0-9]+[.,]?[0-9]*)\\s*€/);
        if (priceMatch) {
          var price = cleanPrice(priceMatch[0]);
          var titleEl = a.querySelector('h2, h3, h4, p, span');
          var title = titleEl ? titleEl.textContent.trim() : a.textContent.trim().substring(0, 120);
          title = title.replace(/\\s+/g, ' ').trim();
          var imgEl = a.querySelector('img');
          var img = imgEl ? getAbsUrl(imgEl.getAttribute('src')) : '';
          if (title && title.length > 3 && price > 0 && !seen[url || title]) {
            seen[url || title] = true;
            ads.push({ title: title.substring(0, 120), price: price, url: url, imageUrl: img });
          }
        }
      });
    }

    // Assign IDs
    ads = ads.slice(0, 50).map(function(ad, i) {
      ad.id = 'ad_' + i;
      return ad;
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'EXTRACTED_ADS', ads: ads }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'EXTRACTED_ADS', ads: [], error: e.message }));
  }
})();
true;
`;
}

interface GeminiAiResult {
  id: string;
  estimatedValue: number;
  category: string;
  description: string;
  imageKeyword: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

function buildMappingPrompt(merchantName: string, ads: ExtractedAd[]): string {
  const lightAds = ads.map(a => ({
    id: a.id,
    title: a.title,
    price: a.price,
    desc: a.description?.substring(0, 80) ?? '',
  }));

  return `Tu es un EXPERT en achat-revente et flipping depuis 15 ans. Tu connais parfaitement les cotes du marché de l'occasion en France.

Voici ${ads.length} annonces extraites de "${merchantName}" au format JSON :
${JSON.stringify(lightAds)}

MISSION : Identifie les pépites (bonnes affaires) parmi ces annonces.

CRITÈRES :
1. Prix au minimum 8% sous la valeur marché de revente (profit NET après ~15% frais plateforme + ~8€ envoi)
2. Produit revendable sur Vinted, eBay, Le Bon Coin, Vestiaire Collective, etc.
3. Tout profit compte, même 5-10€
4. Sois TRÈS inclusif : dès 8% de marge = pépite

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "pepites": [
    {
      "id": "ad_X",
      "estimatedValue": 0,
      "category": "Catégorie",
      "description": "Pourquoi c'est une bonne affaire",
      "imageKeyword": "mot-clé anglais (watch, sneakers, handbag, phone, laptop, console, jewelry, furniture, camera, vintage, gaming, clothing, bag, bike, book, vinyl, electronics, art, shoes)"
    }
  ]
}

RÈGLES :
- "id" DOIT correspondre exactement à un id de la liste fournie
- N'invente JAMAIS d'annonce. UNIQUEMENT celles de la liste
- estimatedValue = prix de revente réaliste sur le marché
- Si aucune bonne affaire : {"pepites": []}
- Retourne 1 à 10 pépites maximum`;
}

function buildVideoMappingPrompt(merchantName: string, ads: ExtractedAd[]): string {
  const lightAds = ads.map(a => ({
    id: a.id,
    title: a.title,
    price: a.price,
  }));

  const adsSection = ads.length > 0
    ? `\nDonnées structurées extraites (${ads.length} annonces) :\n${JSON.stringify(lightAds)}`
    : '';

  return `Tu es un EXPERT en achat-revente et flipping depuis 15 ans.

Tu reçois des captures d'écran d'un utilisateur qui navigue sur "${merchantName}".
${adsSection}

MISSION : Identifie les VRAIES bonnes affaires visibles.

${ads.length > 0 ? `Si tu reconnais une annonce de la liste extraite, utilise son "id" exact.
Si tu vois une annonce qui N'EST PAS dans la liste, utilise "id": "new_X" (X = numéro).` : `Comme aucune donnée structurée n'a été extraite, identifie les annonces visibles dans les images.
Utilise "id": "new_0", "new_1", etc.`}

CRITÈRES :
1. Prix au minimum 8% sous la valeur marché
2. Produit revendable
3. Tout profit compte, même 5-10€

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "pepites": [
    {
      "id": "ad_X ou new_X",
      "title": "Titre si new_X",
      "sellerPrice": 0,
      "estimatedValue": 0,
      "category": "Catégorie",
      "description": "Pourquoi c'est une bonne affaire",
      "imageKeyword": "mot-clé anglais (watch, sneakers, handbag, phone, laptop, console, jewelry, furniture, camera, vintage, gaming, clothing, bag, bike, book, vinyl, electronics, art, shoes)",
      "adUrl": "",
      "adImageUrl": ""
    }
  ]
}

RÈGLES :
- Pour les annonces de la liste : utilise UNIQUEMENT l'id, pas besoin de title/sellerPrice/adUrl/adImageUrl
- Pour les annonces "new_X" : remplis title, sellerPrice, adUrl (si visible, sinon ""), adImageUrl (si visible et < 200 chars, sinon "")
- Si aucune annonce réelle : {"pepites": []}
- Retourne 1 à 10 pépites max`;
}

function buildTextOnlyFallbackPrompt(merchantName: string, pageContent: string): string {
  return `Tu es un EXPERT en achat-revente et flipping depuis 15 ans.

CONTEXTE : L'utilisateur navigue sur "${merchantName}".
Contenu extrait de la page :
---
${pageContent.substring(0, 8000)}
---

MISSION : Identifie les bonnes affaires dans ce contenu.

CRITÈRES :
1. Prix au minimum 8% sous la valeur marché de revente
2. Produit revendable
3. Tout profit compte, même 5-10€

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "pepites": [
    {
      "id": "new_0",
      "title": "Nom du produit",
      "sellerPrice": 0,
      "estimatedValue": 0,
      "category": "Catégorie",
      "description": "Pourquoi c'est une bonne affaire",
      "imageKeyword": "mot-clé anglais (watch, sneakers, handbag, phone, laptop, console, jewelry, furniture, camera, vintage, gaming, clothing, bag, bike, book, vinyl, electronics, art, shoes)"
    }
  ]
}

RÈGLES :
- N'invente JAMAIS d'annonces. UNIQUEMENT celles du contenu réel
- Si aucune annonce réelle : {"pepites": []}
- Retourne 1 à 10 pépites max`;
}

function parseAndRecombine(data: GeminiResponse, merchantName: string, extractedAds: ExtractedAd[]): Pepite[] {
  if (data.error) {
    console.error('[ScanService] Gemini returned error:', data.error);
    throw new Error(data.error.message ?? 'Erreur inconnue de Gemini');
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    console.error('[ScanService] No text content in Gemini response');
    throw new Error('Réponse vide de Gemini. Réessayez.');
  }

  console.log('[ScanService] ========== GEMINI RAW RESPONSE ==========');
  console.log('[ScanService] Response length:', textContent.length, 'chars');
  console.log('[ScanService] Raw text:', textContent.substring(0, 800));

  let parsed: { pepites: GeminiAiResult[] };
  try {
    const cleanJson = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(cleanJson);
  } catch {
    console.log('[ScanService] Initial parse failed, attempting repair...');
    try {
      parsed = repairTruncatedJson(textContent);
    } catch (repairError) {
      console.error('[ScanService] Failed to repair JSON:', repairError);
      console.error('[ScanService] Raw text was:', textContent.substring(0, 1000));
      throw new Error('Erreur de parsing de la réponse IA. Réessayez.');
    }
  }

  if (!parsed.pepites || !Array.isArray(parsed.pepites) || parsed.pepites.length === 0) {
    console.log('[ScanService] No pepites found in Gemini analysis');
    return [];
  }

  const adsMap = new Map<string, ExtractedAd>();
  for (const ad of extractedAds) {
    adsMap.set(ad.id, ad);
  }

  console.log(`[ScanService] Recombining ${parsed.pepites.length} AI results with ${extractedAds.length} extracted ads`);

  const now = new Date();
  const pepites: Pepite[] = [];

  for (let i = 0; i < parsed.pepites.length; i++) {
    const aiResult = parsed.pepites[i];
    const originalAd = adsMap.get(aiResult.id);

    if (originalAd) {
      const sellerPrice = originalAd.price;
      const estimatedValue = aiResult.estimatedValue ?? 0;
      const profit = estimatedValue - sellerPrice;

      const imageUrl = originalAd.imageUrl && originalAd.imageUrl.startsWith('http')
        ? originalAd.imageUrl
        : getImageForQuery(aiResult.imageKeyword ?? aiResult.category ?? 'default');

      const sourceUrl = originalAd.url && originalAd.url.startsWith('http')
        ? originalAd.url
        : '';

      console.log(`[ScanService] ✅ Matched ad_${aiResult.id}: "${originalAd.title}" | ${sellerPrice}€ → ${estimatedValue}€ | URL: ${sourceUrl ? 'YES' : 'NO'} | IMG: ${originalAd.imageUrl ? 'YES' : 'FALLBACK'}`);

      pepites.push({
        id: `gemini_${Date.now()}_${i}`,
        title: originalAd.title,
        image: imageUrl,
        sellerPrice,
        estimatedValue,
        profit,
        source: merchantName,
        sourceUrl,
        category: aiResult.category ?? 'Divers',
        description: aiResult.description ?? 'Bonne affaire détectée par l\'IA',
        scanDate: new Date(now.getTime() - i * 60000).toISOString(),
        isFavorite: false,
        isTrashed: false,
      });
    } else if (aiResult.id.startsWith('new_')) {
      const anyResult = aiResult as any;
      const sellerPrice = anyResult.sellerPrice ?? 0;
      const estimatedValue = aiResult.estimatedValue ?? 0;
      const profit = estimatedValue - sellerPrice;

      const adImageUrl = anyResult.adImageUrl ?? '';
      const imageUrl = adImageUrl && adImageUrl.startsWith('http') && adImageUrl.length < 500
        ? adImageUrl
        : getImageForQuery(aiResult.imageKeyword ?? aiResult.category ?? 'default');

      const adUrl = anyResult.adUrl ?? '';
      const sourceUrl = adUrl && adUrl.startsWith('http') ? adUrl : '';

      console.log(`[ScanService] ⚡ New ad "${anyResult.title ?? 'Unknown'}": ${sellerPrice}€ → ${estimatedValue}€`);

      pepites.push({
        id: `gemini_${Date.now()}_${i}`,
        title: anyResult.title ?? 'Produit détecté',
        image: imageUrl,
        sellerPrice,
        estimatedValue,
        profit,
        source: merchantName,
        sourceUrl,
        category: aiResult.category ?? 'Divers',
        description: aiResult.description ?? 'Bonne affaire détectée par l\'IA',
        scanDate: new Date(now.getTime() - i * 60000).toISOString(),
        isFavorite: false,
        isTrashed: false,
      });
    } else {
      console.warn(`[ScanService] Unknown id "${aiResult.id}", skipping`);
    }
  }

  console.log(`[ScanService] Final result: ${pepites.length} pepites with recombined data`);
  return pepites;
}

function repairTruncatedJson(raw: string): { pepites: any[] } {
  let text = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  console.log('[ScanService] Attempting JSON repair, text length:', text.length);

  try {
    const direct = JSON.parse(text);
    if (direct.pepites && Array.isArray(direct.pepites)) return direct;
  } catch {}

  const pepitesMatch = text.match(/"pepites"\s*:\s*\[/);
  if (!pepitesMatch || pepitesMatch.index === undefined) {
    throw new Error('Cannot repair: no pepites array found');
  }

  const arrayStart = pepitesMatch.index + pepitesMatch[0].length;
  const arrayContent = text.substring(arrayStart);

  const completePepites: any[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objectStart = -1;

  for (let i = 0; i < arrayContent.length; i++) {
    const ch = arrayContent[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objectStart >= 0) {
        const obj = arrayContent.substring(objectStart, i + 1);
        try {
          const parsed = JSON.parse(obj);
          if (parsed.id) {
            completePepites.push(parsed);
            console.log(`[ScanService] Recovered object #${completePepites.length}: id=${parsed.id}`);
          }
        } catch {
          console.log('[ScanService] Skipping malformed object');
        }
        objectStart = -1;
      }
    }
  }

  if (depth > 0 && objectStart >= 0) {
    console.log('[ScanService] Found truncated object at end, attempting repair...');
    const incompleteObj = arrayContent.substring(objectStart);
    try {
      let fixed = incompleteObj.trim();
      if (fixed.endsWith(',')) fixed = fixed.slice(0, -1);
      const lastCompleteField = fixed.lastIndexOf(',"');
      if (lastCompleteField > 0) {
        fixed = fixed.substring(0, lastCompleteField);
      }
      if (!fixed.endsWith('}')) fixed += '}';
      const repaired = JSON.parse(fixed);
      if (repaired.id) {
        completePepites.push(repaired);
        console.log(`[ScanService] Repaired truncated object: id=${repaired.id}`);
      }
    } catch {}
  }

  if (completePepites.length === 0) {
    throw new Error('Cannot repair: no complete objects found');
  }

  console.log(`[ScanService] Recovered ${completePepites.length} pepites from truncated response`);
  return { pepites: completePepites };
}

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiApi(apiKey: string, parts: GeminiPart[]): Promise<GeminiResponse> {
  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  console.log(`[ScanService] Calling Gemini API with ${parts.length} parts`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`[ScanService] Retry ${attempt}/${MAX_RETRIES} after ${Math.round(backoff)}ms`);
      await delay(backoff);
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      return response.json();
    }

    const errorText = await response.text();
    console.error(`[ScanService] Gemini API error ${response.status} (attempt ${attempt + 1}):`, errorText);

    if (response.status === 429 || response.status === 503) {
      if (attempt < MAX_RETRIES) {
        console.log(`[ScanService] Rate limited, will retry...`);
        continue;
      }
      throw new Error('Quota API dépassé. Vérifiez votre plan Gemini ou réessayez dans quelques minutes.');
    }

    if (response.status === 400) {
      throw new Error('Clé API invalide ou requête malformée. Vérifiez votre clé dans les réglages.');
    }
    if (response.status === 403) {
      throw new Error('Clé API non autorisée. Vérifiez que votre clé Gemini est active.');
    }
    throw new Error(`Erreur API Gemini (${response.status}). Réessayez.`);
  }

  throw new Error('Impossible de joindre l\'API Gemini après plusieurs tentatives.');
}

export async function analyzeWithGeminiVideo(
  apiKey: string,
  merchantName: string,
  screenshots: string[],
  pageContent: string,
  extractedAds: ExtractedAd[] = [],
): Promise<Pepite[]> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Clé API Gemini non configurée. Allez dans Réglages > Clé API pour la configurer.');
  }

  console.log('[ScanService] ========== VIDEO + MAPPING ANALYSIS START ==========');
  console.log(`[ScanService] Merchant: ${merchantName}`);
  console.log(`[ScanService] Frames: ${screenshots.length}`);
  console.log(`[ScanService] Extracted ads: ${extractedAds.length}`);
  console.log(`[ScanService] Text content: ${pageContent.length} chars`);

  const validFrames = screenshots.filter(s => s && s.length > 100);
  if (validFrames.length === 0 && extractedAds.length > 0) {
    console.log('[ScanService] No frames but have extracted ads, using mapping-only mode');
    return analyzeWithMapping(apiKey, merchantName, extractedAds);
  }

  if (validFrames.length === 0 && extractedAds.length === 0) {
    console.log('[ScanService] No frames and no ads, falling back to text-only');
    return analyzeWithGemini(apiKey, merchantName, pageContent);
  }

  const maxFrames = 6;
  let selectedFrames: string[];
  if (validFrames.length <= maxFrames) {
    selectedFrames = validFrames;
  } else {
    selectedFrames = [];
    const step = (validFrames.length - 1) / (maxFrames - 1);
    for (let i = 0; i < maxFrames; i++) {
      const idx = Math.round(i * step);
      selectedFrames.push(validFrames[idx]);
    }
  }

  const prompt = buildVideoMappingPrompt(merchantName, extractedAds);
  console.log(`[ScanService] Prompt length: ${prompt.length} chars`);

  const parts: GeminiPart[] = [{ text: prompt }];
  for (const frame of selectedFrames) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: frame,
      },
    });
  }

  const data = await callGeminiApi(apiKey, parts);
  console.log('[ScanService] Gemini video+mapping response received');
  return parseAndRecombine(data, merchantName, extractedAds);
}

export async function analyzeWithMapping(
  apiKey: string,
  merchantName: string,
  extractedAds: ExtractedAd[],
): Promise<Pepite[]> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Clé API Gemini non configurée. Allez dans Réglages > Clé API pour la configurer.');
  }

  console.log('[ScanService] ========== MAPPING-ONLY ANALYSIS START ==========');
  console.log(`[ScanService] Merchant: ${merchantName}`);
  console.log(`[ScanService] Extracted ads: ${extractedAds.length}`);
  extractedAds.forEach((ad, i) => {
    console.log(`[ScanService]   ad_${i}: "${ad.title}" ${ad.price}€ | URL: ${ad.url ? 'YES' : 'NO'} | IMG: ${ad.imageUrl ? 'YES' : 'NO'}`);
  });

  const prompt = buildMappingPrompt(merchantName, extractedAds);
  console.log(`[ScanService] Prompt length: ${prompt.length} chars`);

  const parts: GeminiPart[] = [{ text: prompt }];
  const data = await callGeminiApi(apiKey, parts);
  console.log('[ScanService] Gemini mapping response received');
  return parseAndRecombine(data, merchantName, extractedAds);
}

export async function analyzeWithGemini(
  apiKey: string,
  merchantName: string,
  pageContent: string,
): Promise<Pepite[]> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Clé API Gemini non configurée. Allez dans Réglages > Clé API pour la configurer.');
  }

  console.log('[ScanService] ========== TEXT-ONLY FALLBACK ==========');
  console.log(`[ScanService] Merchant: ${merchantName}`);
  console.log(`[ScanService] Page content: ${pageContent.length} chars`);

  if (pageContent.length === 0) {
    console.warn('[ScanService] No content at all, returning empty');
    return [];
  }

  const prompt = buildTextOnlyFallbackPrompt(merchantName, pageContent);
  const parts: GeminiPart[] = [{ text: prompt }];
  const data = await callGeminiApi(apiKey, parts);
  return parseAndRecombine(data, merchantName, []);
}

export function generateFallbackPepites(merchantName: string): Pepite[] {
  const fallbackItems = [
    {
      title: 'Rolex Datejust 36mm 1978',
      sellerPrice: 2800,
      estimatedValue: 5500,
      profit: 2700,
      source: merchantName,
      sourceUrl: `https://www.${merchantName.toLowerCase().replace(/\s/g, '')}.fr`,
      category: 'Montres',
      description: 'Rolex Datejust vintage en or et acier. Cadran champagne en excellent état.',
      image: UNSPLASH_IMAGES.watch,
    },
    {
      title: 'Sac Louis Vuitton Speedy 30',
      sellerPrice: 180,
      estimatedValue: 650,
      profit: 470,
      source: merchantName,
      sourceUrl: `https://www.${merchantName.toLowerCase().replace(/\s/g, '')}.fr`,
      category: 'Luxe / Maroquinerie',
      description: 'Speedy 30 en toile Monogram avec patine miel.',
      image: UNSPLASH_IMAGES.handbag,
    },
    {
      title: 'Nintendo 64 + 12 jeux',
      sellerPrice: 45,
      estimatedValue: 220,
      profit: 175,
      source: merchantName,
      sourceUrl: `https://www.${merchantName.toLowerCase().replace(/\s/g, '')}.fr`,
      category: 'Retro Gaming',
      description: 'Lot N64 complet avec 12 jeux dont Zelda OOT et Mario 64.',
      image: UNSPLASH_IMAGES.gaming,
    },
  ];

  const now = new Date();
  return fallbackItems.map((item, index) => ({
    ...item,
    id: `fallback_${Date.now()}_${index}`,
    scanDate: new Date(now.getTime() - index * 60000).toISOString(),
    isFavorite: false,
    isTrashed: false,
  }));
}
