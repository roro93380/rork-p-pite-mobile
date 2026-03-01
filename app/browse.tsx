import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Square, Zap, Shield, Video, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePepite } from '@/providers/PepiteProvider';

const SCAN_TIPS = [
  '☕ Prenez un café, Pépite s\'en charge',
  '🎯 Pépite analyse chaque annonce pour vous',
  '⏸️ Restez juste dans la page... Pépite fait le boulot!',
  '😎 Détendez-vous, laissez l\'app scanner',
  '🔍 Tous les articles sont capturés automatiquement',
  '✨ Pépite cherche les meilleures pépites',
  '🚀 Ne touchez rien, nous scrollons via l\'IA',
  '💰 Les marges sont calculées en temps réel',
];

const ANALYSIS_STEPS = [
  'Captures envoy\u00e9es \u00e0 Gemini',
  'Analyse des annonces d\u00e9tect\u00e9es',
  '\u00c9valuation des prix du march\u00e9',
  'Calcul des marges de revente',
  'S\u00e9lection des meilleures p\u00e9pites',
];

const SCAN_DURATION_LIMIT = 30;
const MAX_SCREENSHOTS = 8;
const MIN_SCREENSHOT_INTERVAL = 3000;
const MAX_SCREENSHOT_INTERVAL = 7000;
const MIN_EXTRACT_INTERVAL = 4000;
const MAX_EXTRACT_INTERVAL = 8000;

// User-Agent réaliste selon la plateforme
const WEBVIEW_USER_AGENT =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

// Script de scroll aléatoire injecté pendant le scan pour imiter un comportement humain
const SCROLL_SCRIPT = `
(function() {
  try {
    window.__scrollRunning = true;
    var scrollStep = function() {
      if (!window.__scrollRunning) return;
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      var current = window.scrollY;
      var target = Math.min(current + Math.floor(Math.random() * 300 + 100), maxScroll);
      window.scrollTo({ top: target, behavior: 'smooth' });
      setTimeout(scrollStep, Math.random() * 2000 + 1000);
    };
    scrollStep();
  } catch(e) {}
})();
true;
`;

// Script pour arrêter le scroll
const STOP_SCROLL_SCRIPT = `
(function() {
  try {
    window.__scrollRunning = false;
  } catch(e) {}
})();
true;
`;

const CONTENT_EXTRACT_JS = `
(function() {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: 'EXTRACT_JS_START', url: window.location.href }));
    var items = [];
    var loc = window.location.href;
    var isVinted = loc.includes('vinted.fr');
    var isEbay = loc.includes('ebay.com') || loc.includes('ebay.fr');
    var isAmazon = loc.includes('amazon.fr') || loc.includes('amazon.com');
    var isRakuten = loc.includes('rakuten.com') || loc.includes('rakuten.fr');
    var isBackMarket = loc.includes('backmarket.com') || loc.includes('backmarket.fr');
    var isVestiaire = loc.includes('vestiairecollective.com');
    var isSelency = loc.includes('selency.com') || loc.includes('selency.fr');
    var isAutoScout = loc.includes('autoscout24.');
    var isKleinanzeigen = loc.includes('kleinanzeigen.de');
    var isAgorastore = loc.includes('agorastore.fr');
    var isLabelEmmaus = loc.includes('label-emmaus.co');
    var isZenMarket = loc.includes('zenmarket.jp');
    var isStocklear = loc.includes('stocklear.fr');
    var isCatawiki = loc.includes('catawiki.com');
    var isWallapop = loc.includes('wallapop.com');
    var isTroostwijk = loc.includes('troostwijkauctions.com') || loc.includes('troostwijk.');
    var isLeboncoin = loc.includes('leboncoin.fr');
    var debugInfo = '';
    
    if (isVinted) {
      // === VINTED ===
      var containers = document.querySelectorAll('[class*="new-item-box"]');
      debugInfo = 'Vinted: ' + containers.length + ' containers';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: 'VINTED: containers=' + containers.length + ' | url=' + loc }));
      
      for (var i = 0; i < containers.length; i++) {
        try {
          var container = containers[i];
          var linkEl = container.querySelector('a[href*="/items/"]');
          var link = linkEl ? 'https://www.vinted.fr' + linkEl.getAttribute('href') : '';
          var title = linkEl ? linkEl.getAttribute('title') : '';
          var priceMatch = title.match(/([0-9]+[.,][0-9]{2}\\s*€)/);
          var price = priceMatch ? priceMatch[1] : '';
          var imageUrl = '';
          var img = container.querySelector('img');
          if (img) {
            imageUrl = img.src || img.getAttribute('data-src') || '';
          }
          var titleOnly = title.split(',')[0].trim() || 'Item';
          
          if (link && titleOnly) {
            items.push({ title: titleOnly, price: price, link: link, image: imageUrl });
          }
        } catch(e) {}
      }
    } else if (isEbay) {
      // === EBAY (eBay.fr) ===
      var cards = document.querySelectorAll('li.s-card');
      debugInfo = 'eBay: ' + cards.length + ' cards';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: 'EBAY: cards=' + cards.length + ' | url=' + loc }));
      
      for (var i = 0; i < cards.length; i++) {
        try {
          var card = cards[i];
          var title = '';
          var price = '';
          var link = '';
          var imageUrl = '';
          
          // Récupérer le lien depuis le titre (plus fiable)
          var titleLink = card.querySelector('a.s-card__link[href*="/itm/"]');
          if (titleLink) {
            var href = titleLink.getAttribute('href') || '';
            // Nettoyer l'URL: enlever les paramètres après ?
            link = href.split('?')[0];
            if (!link.startsWith('http')) {
              link = 'https://www.ebay.fr' + link;
            }
          }
          
          // Titre (depuis le span du heading)
          var titleSpan = card.querySelector('.s-card__title span');
          if (titleSpan) {
            title = titleSpan.innerText.trim();
          }
          
          // Prix (exact text du span)
          var priceEl = card.querySelector('.s-card__price');
          if (priceEl) {
            price = priceEl.innerText.trim();
          }
          
          // Image (depuis src ou data-src)
          var img = card.querySelector('img.s-card__image');
          if (img) {
            imageUrl = img.src || img.getAttribute('data-src') || '';
          }
          
          // Validation et ajout
          // Filtrer les items de navigation (trop courts, pas importants)
          var isSuspicious = title.toLowerCase().match(/^(mon ebay|panier|menu|tout|ench|achat|shop|brand|best offer|sponsored)/i);
          if (title && title.length > 10 && link && link.includes('/itm/') && !isSuspicious && (price || imageUrl)) {
            items.push({ 
              title: title, 
              price: price || 'N/A', 
              link: link, 
              image: imageUrl 
            });
          }
        } catch(e) {}
      }
    } else if (isAmazon) {
      // === AMAZON ===
      var products = document.querySelectorAll('[data-component-type="s-search-result"]');
      debugInfo = 'Amazon: ' + products.length + ' products';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: 'AMAZON: products=' + products.length + ' | url=' + loc }));
      
      for (var i = 0; i < products.length; i++) {
        try {
          var product = products[i];
          var title = '';
          var price = '';
          var link = '';
          var imageUrl = '';
          
          // Titre depuis h2 span
          var titleSpan = product.querySelector('h2 span');
          if (titleSpan) {
            title = titleSpan.innerText.trim();
          }
          
          // Lien depuis a[aria-hidden="true"][href*="/dp/"] (image link)
          var imageLinkEl = product.querySelector('a[aria-hidden="true"][href*="/dp/"]');
          if (imageLinkEl) {
            link = imageLinkEl.getAttribute('href') || '';
          }
          // Fallback: a.a-link-normal
          if (!link) {
            var titleLinkEl = product.querySelector('a.a-link-normal[href*="/dp/"]');
            if (titleLinkEl) {
              link = titleLinkEl.getAttribute('href') || '';
            }
          }
          
          // Nettoyer l'URL: enlever les paramètres après /ref=
          if (link) {
            var refIndex = link.indexOf('/ref=');
            if (refIndex > 0) {
              link = link.substring(0, refIndex);
            }
            if (!link.startsWith('http')) {
              link = 'https://www.amazon.fr' + link;
            }
          }
          
          // Prix depuis .a-price-whole
          var priceEl = product.querySelector('.a-price-whole');
          if (priceEl) {
            price = priceEl.innerText.trim().replace(/\\s+/g, '').replace(',', '.');
          }
          
          // Image depuis img.s-image
          var imgEl = product.querySelector('img.s-image');
          if (imgEl) {
            imageUrl = imgEl.getAttribute('src') || '';
            // Si pas de src, essayer srcset
            if (!imageUrl && imgEl.getAttribute('srcset')) {
              var srcset = imgEl.getAttribute('srcset');
              imageUrl = srcset.split(' ')[0];
            }
          }
          
          // Validation et ajout
          if (title && title.length > 10 && link && link.includes('/dp/') && imageUrl) {
            items.push({ 
              title: title, 
              price: price || 'N/A', 
              link: link, 
              image: imageUrl 
            });
          }
        } catch(e) {}
      }
    } else if (isRakuten) {
      // === RAKUTEN ===
      var products = document.querySelectorAll('div[data-productid]');
      debugInfo = 'Rakuten: ' + products.length + ' products';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: 'RAKUTEN: products=' + products.length + ' | url=' + loc }));
      
      for (var i = 0; i < products.length; i++) {
        try {
          var product = products[i];
          var title = '';
          var price = '';
          var link = '';
          var imageUrl = '';
          
          // Titre depuis p[data-qa="sdt_p"]
          var titleEl = product.querySelector('p[data-qa="sdt_p"]');
          if (titleEl) {
            title = titleEl.innerText.trim();
          }
          
          // Lien depuis a[href*="/mfp/"]
          var linkEl = product.querySelector('a[href*="/mfp/"]');
          if (!linkEl) {
            linkEl = product.querySelector('a[href]');
          }
          if (linkEl) {
            var href = linkEl.getAttribute('href') || '';
            if (href && !href.startsWith('http')) {
              link = 'https://fr.shopping.rakuten.com' + href;
            } else {
              link = href;
            }
            var qIndex = link.indexOf('?');
            if (qIndex > 0) {
              link = link.substring(0, qIndex);
            }
          }
          
          // Prix — occasion en priorité (meilleur deal), sinon neuf
          var usedPriceEl = product.querySelector('[data-qa="used_product"] span.b');
          var newPriceEl = product.querySelector('[data-qa="new_product"] span.b');
          if (usedPriceEl) {
            price = usedPriceEl.innerText.trim();
          } else if (newPriceEl) {
            price = newPriceEl.innerText.trim();
          }
          
          // Image depuis img dans le conteneur
          var imgEl = product.querySelector('img[src]');
          if (imgEl) {
            imageUrl = imgEl.getAttribute('src') || '';
          }
          
          // Validation
          if (title && title.length > 5 && link && link.includes('/mfp/')) {
            items.push({ 
              title: title, 
              price: price || 'N/A', 
              link: link, 
              image: imageUrl 
            });
          }
        } catch(e) {}
      }
    } else if (isBackMarket) {
      // === BACK MARKET (with heavy debug) ===
      var sel1 = document.querySelectorAll('div[data-qa="productCard"]').length;
      var sel2 = document.querySelectorAll('[data-test="product-card"]').length;
      var sel3 = document.querySelectorAll('[class*="productCard"]').length;
      var sel4 = document.querySelectorAll('[class*="ProductCard"]').length;
      var sel5 = document.querySelectorAll('a[href*="/p/"]').length;
      var sel6 = document.querySelectorAll('img[data-test="product-card-image"]').length;
      var sel7 = document.querySelectorAll('[class*="product"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      
      debugInfo = 'BM_SELECTORS: data-qa-productCard=' + sel1 + ' | test-product-card=' + sel2 + ' | cls-productCard=' + sel3 + ' | cls-ProductCard=' + sel4 + ' | a-href-p=' + sel5 + ' | test-img=' + sel6 + ' | cls-product=' + sel7 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      // Strategy 1: Try main selector
      var products = document.querySelectorAll('div[data-qa="productCard"]');
      
      if (products.length > 0) {
        debugInfo += ' | Strategy1: productCard=' + products.length;
        for (var i = 0; i < products.length; i++) {
          try {
            var product = products[i];
            var title = '';
            var price = '';
            var link = '';
            var imageUrl = '';
            
            var titleEl = product.querySelector('span[data-test="product-title"]');
            if (titleEl) title = titleEl.innerText.trim();
            
            var linkEl = product.querySelector('a[href*="/p/"]');
            if (linkEl) {
              var href = linkEl.getAttribute('href') || '';
              link = href.startsWith('http') ? href : 'https://www.backmarket.fr' + href;
            }
            
            var priceContainerEl = product.querySelector('div[data-qa="productCardPrice"]');
            if (priceContainerEl) {
              var priceBoldEl = priceContainerEl.querySelector('div.body-2-bold');
              if (priceBoldEl) {
                var priceText = priceBoldEl.innerText.trim();
                price = priceText.split('\\n')[0] || priceText;
              }
            }
            
            var imgEl = product.querySelector('img[data-test="product-card-image"]');
            if (imgEl) imageUrl = imgEl.getAttribute('src') || '';
            
            if (title && title.length > 3 && link) {
              items.push({ title: title, price: price || 'N/A', link: link, image: imageUrl });
            }
          } catch(e) {}
        }
      }
      
      // Strategy 2: Fallback - use ALL links to /p/ pages
      if (items.length === 0) {
        var pLinks = document.querySelectorAll('a[href*="/p/"]');
        debugInfo += ' | Strategy2: a-p-links=' + pLinks.length;
        var seenLinks = {};
        
        for (var i = 0; i < pLinks.length; i++) {
          try {
            var a = pLinks[i];
            var href = a.getAttribute('href') || '';
            if (seenLinks[href]) continue;
            seenLinks[href] = true;
            
            var link = href.startsWith('http') ? href : 'https://www.backmarket.fr' + href;
            
            // Get title from link text or children
            var title = '';
            var spans = a.querySelectorAll('span, h2, h3, p');
            for (var s = 0; s < spans.length; s++) {
              var txt = spans[s].innerText ? spans[s].innerText.trim() : '';
              if (txt.length > 5 && txt.length < 200) { title = txt; break; }
            }
            if (!title) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
            
            // Get image from link or nearby
            var imgEl = a.querySelector('img');
            var imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
            
            // Get price: look in parent containers
            var price = '';
            var parentEl = a.parentElement;
            for (var up = 0; up < 5 && parentEl; up++) {
              var allText = parentEl.innerText || '';
              var priceMatch = allText.match(/(\\d+[.,]\\d{2})\\s*€/);
              if (priceMatch) { price = priceMatch[0]; break; }
              parentEl = parentEl.parentElement;
            }
            
            if (title && title.length > 3 && link.includes('/p/')) {
              items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
            }
          } catch(e) {}
        }
      }
      
      // Strategy 3: Last resort - grab ALL images and nearby links
      if (items.length === 0) {
        var allPageImgs = document.querySelectorAll('img[src*="back"], img[src*="cdn"], img[loading="lazy"]');
        debugInfo += ' | Strategy3: lazy-imgs=' + allPageImgs.length;
        
        for (var i = 0; i < Math.min(allPageImgs.length, 30); i++) {
          try {
            var img = allPageImgs[i];
            var imageUrl = img.getAttribute('src') || '';
            if (imageUrl.length < 20) continue;
            
            // Find closest link
            var closestA = img.closest('a');
            if (!closestA) closestA = img.parentElement ? img.parentElement.closest('a') : null;
            var link = closestA ? (closestA.getAttribute('href') || '') : '';
            if (link && !link.startsWith('http')) link = 'https://www.backmarket.fr' + link;
            
            var title = img.getAttribute('alt') || '';
            if (title && title.length > 3 && link) {
              items.push({ title: title.substring(0, 150), price: 'N/A', link: link, image: imageUrl });
            }
          } catch(e) {}
        }
      }
      
      debugInfo += ' | FINAL_ITEMS=' + items.length;
    } else if (isVestiaire) {
      // === VESTIAIRE COLLECTIVE ===
      var sel1 = document.querySelectorAll('[class*="productCard"], [class*="ProductCard"]').length;
      var sel2 = document.querySelectorAll('a[href*="/product/"]').length;
      var sel3 = document.querySelectorAll('[data-testid*="product"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'Vestiaire: cls-productCard=' + sel1 + ' | a-product=' + sel2 + ' | testid-product=' + sel3 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      // Strategy 1: product cards
      var products = document.querySelectorAll('[class*="productCard"], [class*="ProductCard"], [data-testid*="product"]');
      if (products.length === 0) products = document.querySelectorAll('a[href*="/product/"]');
      debugInfo += ' | found=' + products.length;
      
      var seenLinks = {};
      for (var i = 0; i < products.length; i++) {
        try {
          var el = products[i];
          var a = el.tagName === 'A' ? el : el.querySelector('a[href*="/product/"]');
          if (!a) a = el.querySelector('a[href]');
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : 'https://www.vestiairecollective.com' + href;
          
          var title = '';
          var titleEl = el.querySelector('[class*="product_name"], [class*="brand"], h3, h2, span');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imgEl = el.querySelector('img');
          var imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
          
          var price = '';
          var priceEl = el.querySelector('[class*="price"], [class*="Price"]');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | FINAL_ITEMS=' + items.length;

    } else if (isSelency) {
      // === SELENCY ===
      var sel1 = document.querySelectorAll('a[href*="/p/"]').length;
      var sel2 = document.querySelectorAll('img[src*="images.selency.com"], img[src*="selency.com"]').length;
      var sel3 = document.querySelectorAll('[class*="product-card"], [class*="ProductCard"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'Selency: a-/p/=' + sel1 + ' | img-selency=' + sel2 + ' | cls-product-card=' + sel3 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo + ' | url=' + loc }));
      
      var productLinks = document.querySelectorAll('a[href*="/p/"]');
      debugInfo += ' | found=' + productLinks.length;
      
      var seenLinks = {};
      for (var i = 0; i < productLinks.length; i++) {
        try {
          var a = productLinks[i];
          var href = a.getAttribute('href') || '';
          if (!href) continue;
          
          var normalizedHref = href.split('?')[0];
          if (seenLinks[normalizedHref]) continue;
          seenLinks[normalizedHref] = true;
          
          var link = normalizedHref.startsWith('http') ? normalizedHref : 'https://www.selency.fr' + normalizedHref;
          if (!link.includes('/p/')) continue;
          
          var title = a.innerText ? a.innerText.trim() : '';
          if (!title || title.length < 4) {
            var titleEl = a.querySelector('h2, h3, [class*="title"], [class*="name"], span, p');
            if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          }
          if (!title || title.length < 4) {
            var aria = a.getAttribute('aria-label') || '';
            if (aria) title = aria.trim();
          }
          
          var imageUrl = '';
          var imgEl = a.querySelector('img');
          if (!imgEl) {
            var card = a.closest('article, li, [class*="product"], [class*="card"], [class*="item"]');
            if (card) imgEl = card.querySelector('img');
          }
          if (imgEl) {
            imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset') || '';
            if (imageUrl && imageUrl.indexOf(' ') > 0) imageUrl = imageUrl.split(' ')[0];
          }
          
          var price = '';
          var contextEl = a.closest('article, li, [class*="product"], [class*="card"], [class*="item"]') || a.parentElement;
          if (contextEl) {
            var contextText = contextEl.innerText || '';
            var priceMatch = contextText.match(/(\d[\d\s\u202F]*[.,]?\d*)\s*€/);
            if (priceMatch) price = priceMatch[0].trim();
          }
          
          if (title && title.length > 3) {
            items.push({ title: title.substring(0, 180), price: price || 'N/A', link: link, image: imageUrl || '' });
          }
        } catch(e) {}
      }
      debugInfo += ' | FINAL_ITEMS=' + items.length;

    } else if (isAutoScout) {
      // === AUTOSCOUT24 ===
      var sel1 = document.querySelectorAll('article[data-testid="list-item"], article.list-page-item').length;
      var sel2 = document.querySelectorAll('a[data-anchor-overlay="true"], a[href*="/offres/"]').length;
      var sel3 = document.querySelectorAll('img[data-testid="list-item-image"], img.ListItemImage_image__syCVC').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'AutoScout24: list-items=' + sel1 + ' | overlay-links=' + sel2 + ' | list-images=' + sel3 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var listings = document.querySelectorAll('article[data-testid="list-item"], article.list-page-item');
      debugInfo += ' | found=' + listings.length;

      var seenLinks = {};
      for (var i = 0; i < listings.length; i++) {
        try {
          var el = listings[i];
          var a = el.querySelector('a[data-anchor-overlay="true"]');
          if (!a) a = el.querySelector('a.ListItemTitle_anchor__4TrfR[href]');
          if (!a) a = el.querySelector('a[href*="/offres/"]');
          if (!a) a = el.querySelector('a[href]');
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href) continue;
          var qIdx = href.indexOf('?');
          if (qIdx > 0) href = href.substring(0, qIdx);
          var link = href.startsWith('http') ? href : 'https://www.autoscout24.fr' + href;
          if (link.indexOf('/offres/') < 0 && link.indexOf('/offers/') < 0 && link.indexOf('/annonces/') < 0) continue;
          if (seenLinks[link]) continue;
          seenLinks[link] = true;
          
          var title = '';
          var titleEl = el.querySelector('.ListItemTitle_title__sLi_x');
          var subtitleEl = el.querySelector('.ListItemTitle_subtitle__V_ao6');
          if (!titleEl) titleEl = el.querySelector('h2, h3, [class*="title"], [class*="Title"], [data-testid*="title"]');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (subtitleEl && subtitleEl.innerText) {
            title = (title ? title + ' ' : '') + subtitleEl.innerText.trim();
          }
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imageUrl = '';
          var imgEl = el.querySelector('img[data-testid="list-item-image"]');
          if (!imgEl) imgEl = el.querySelector('img.ListItemImage_image__syCVC');
          if (!imgEl) imgEl = el.querySelector('img');
          if (imgEl) {
            imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset') || '';
            if (imageUrl && imageUrl.indexOf(' ') > 0) imageUrl = imageUrl.split(' ')[0];
          }
          
          var price = '';
          var priceEl = el.querySelector('[data-testid="regular-price"]');
          if (!priceEl) priceEl = el.querySelector('[class*="CurrentPrice"], [class*="price"], [class*="Price"]');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          if (!price) {
            var txt = el.innerText || '';
            var m = txt.match(/(\d[\d\s\u202F]*[.,]?\d*)\s*€/);
            if (m) price = m[0];
          }
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }

      // Fallback: parse all offer links when card selector misses
      if (items.length === 0) {
        var allAnchors = document.querySelectorAll('a[href*="/offres/"], a[href*="/offers/"], a[href*="/annonces/"]');
        debugInfo += ' | fallbackOfferLinks=' + allAnchors.length;
        for (var j = 0; j < allAnchors.length; j++) {
          try {
            var a2 = allAnchors[j];
            var href2 = a2.getAttribute('href') || '';
            if (!href2) continue;
            var qIdx2 = href2.indexOf('?');
            if (qIdx2 > 0) href2 = href2.substring(0, qIdx2);
            var link2 = href2.startsWith('http') ? href2 : 'https://www.autoscout24.fr' + href2;
            if (seenLinks[link2]) continue;
            
            var card = a2.closest('article[data-testid="list-item"], article.list-page-item, article, li') || a2.parentElement;
            var title2 = '';
            if (card) {
              var t2 = card.querySelector('.ListItemTitle_title__sLi_x, h2, h3, [class*="title"], [class*="Title"]');
              if (t2) title2 = t2.innerText ? t2.innerText.trim() : '';
            }
            if (!title2) title2 = a2.innerText ? a2.innerText.trim().substring(0, 120) : '';

            var image2 = '';
            var i2 = a2.querySelector('img[data-testid="list-item-image"], img');
            if (!i2 && card) i2 = card.querySelector('img');
            if (i2) {
              image2 = i2.getAttribute('src') || i2.getAttribute('data-src') || i2.getAttribute('srcset') || '';
              if (image2 && image2.indexOf(' ') > 0) image2 = image2.split(' ')[0];
            }

            var price2 = '';
            if (card) {
              var p2 = card.querySelector('[data-testid="regular-price"], [class*="CurrentPrice"], [class*="price"], [class*="Price"]');
              if (p2) price2 = p2.innerText ? p2.innerText.trim() : '';
              if (!price2) {
                var txt2 = card.innerText || '';
                var m2 = txt2.match(/(\d[\d\s\u202F]*[.,]?\d*)\s*€/);
                if (m2) price2 = m2[0];
              }
            }

            if (title2 && title2.length > 3) {
              seenLinks[link2] = true;
              items.push({ title: title2.substring(0, 150), price: price2 || 'N/A', link: link2, image: image2 || '' });
            }
          } catch(e) {}
        }
      }

      debugInfo += ' | FINAL_ITEMS=' + items.length;

    } else if (isKleinanzeigen) {
      // === KLEINANZEIGEN ===
      var sel1 = document.querySelectorAll('[class*="aditem"], article.aditem').length;
      var sel2 = document.querySelectorAll('a[href*="/s-anzeige/"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'Kleinanzeigen: aditem=' + sel1 + ' | a-anzeige=' + sel2 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var ads = document.querySelectorAll('article.aditem, li.ad-listitem article');
      if (ads.length === 0) ads = document.querySelectorAll('[data-href*="/s-anzeige/"], a[href*="/s-anzeige/"]');
      debugInfo += ' | found=' + ads.length;
      
      var seenLinks = {};
      var imgFoundCount = 0;
      for (var i = 0; i < ads.length; i++) {
        try {
          var el = ads[i];
          var article = el.tagName === 'ARTICLE' ? el : el.closest('article.aditem') || el;

          var a = article.querySelector('a[href*="/s-anzeige/"]');
          if (!a && article.tagName === 'A') a = article;
          if (!a) a = article.querySelector('a[href]');

          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href && article.getAttribute) href = article.getAttribute('data-href') || '';
          if (!href || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : 'https://www.kleinanzeigen.de' + href;
          
          var title = '';
          var titleEl = article.querySelector('h2, h3, [class*="title"], [class*="text-module-begin"], a.ellipsis');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imageUrl = '';
          var imgEl = article.querySelector('div.aditem-image img, .srpimagebox img, img[src*="img.kleinanzeigen.de"], img[srcset*="img.kleinanzeigen.de"], img');
          if (imgEl) {
            imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';
            if (!imageUrl) {
              var srcset = imgEl.getAttribute('srcset') || '';
              if (srcset) {
                imageUrl = srcset.split(',')[0].trim().split(' ')[0];
              }
            }
          }

          // Fallback JSON-LD image url in aditem-image block
          if (!imageUrl) {
            var jsonLdScripts = article.querySelectorAll('script[type="application/ld+json"]');
            for (var jl = 0; jl < jsonLdScripts.length; jl++) {
              try {
                var raw = jsonLdScripts[jl].textContent || '';
                if (!raw) continue;
                var parsed = JSON.parse(raw);
                var contentUrl = parsed && parsed.contentUrl ? parsed.contentUrl : '';
                if (contentUrl && contentUrl.indexOf('http') === 0) {
                  imageUrl = contentUrl;
                  break;
                }
              } catch(e) {}
            }
          }
          if (imageUrl) imgFoundCount++;
          
          var price = '';
          var priceEl = article.querySelector('[class*="price"], [class*="Price"], .aditem-main--middle--price-shipping--price');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | imgFound=' + imgFoundCount + ' | FINAL_ITEMS=' + items.length;

    } else if (isAgorastore) {
      // === AGORASTORE ===
      var sel1 = document.querySelectorAll('a.article-link, .container-card a[href*="/materiel-occasion/"], article.new-article').length;
      var sel2 = document.querySelectorAll('a[href*="/materiel-occasion/"]').length;
      var sel3 = document.querySelectorAll('img.thumbnail-img, .thumbnail img[src]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'Agorastore: article-link=' + sel1 + ' | a-materiel=' + sel2 + ' | thumbnail-img=' + sel3 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var products = document.querySelectorAll('a.article-link[href], .container-card a[href*="/materiel-occasion/"]');
      if (products.length === 0) products = document.querySelectorAll('a[href*="/materiel-occasion/"]');
      debugInfo += ' | found=' + products.length;
      
      var seenLinks = {};
      var imgFoundCount = 0;
      for (var i = 0; i < products.length; i++) {
        try {
          var el = products[i];
          var a = el.tagName === 'A' ? el : el.querySelector('a[href*="/materiel-occasion/"]');
          if (!a) a = el.querySelector('a[href]');
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : 'https://www.agorastore.fr' + href;
          if (link.indexOf('/materiel-occasion/') < 0) continue;
          
          var title = '';
          var card = a ? (a.querySelector('article.new-article') || a.closest('.container-card') || a.parentElement) : el;
          var titleEl = (card && card.querySelector) ? card.querySelector('h3.item-title, h2.item-title, .item-title, h2, h3, h4, [class*="title"], [class*="name"]') : null;
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imageUrl = '';
          var imgEl = null;
          if (card && card.querySelector) {
            imgEl = card.querySelector('img.thumbnail-img, .thumbnail img[src], img[srcset]');
          }
          if (!imgEl && a) {
            imgEl = a.querySelector('img.thumbnail-img, .thumbnail img[src], img[srcset], img[src]');
          }
          if (imgEl) {
            imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';
            if (!imageUrl) {
              var srcset = imgEl.getAttribute('srcset') || '';
              if (srcset) imageUrl = srcset.split(',')[0].trim().split(' ')[0];
            }
          }
          if (imageUrl) imgFoundCount++;
          
          var price = '';
          var priceEl = (card && card.querySelector) ? card.querySelector('.text-h6, [class*="price"], [class*="Price"], .font-weight-bold.text-h6') : null;
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          if (!price && card) {
            var txt = card.innerText || '';
            var m = txt.match(/(\d[\d\s\u202F]*[.,]?\d*)\s*€/);
            if (m) price = m[0];
          }
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | imgFound=' + imgFoundCount + ' | FINAL_ITEMS=' + items.length;

    } else if (isLabelEmmaus) {
      // === LABEL EMMAÜS ===
      var sel1 = document.querySelectorAll('.product-card.catalogue-card, .product-card, article.new-article').length;
      var sel2 = document.querySelectorAll('a.js_gtmonclick[href], a.article-link[href], a[href*="/fr/"][href*="-"]').length;
      var sel3 = document.querySelectorAll('img.thumbnail-img, img.solo-img, .image-wrapper img').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'LabelEmmaus: product-card=' + sel1 + ' | a-product-like=' + sel2 + ' | thumb-img=' + sel3 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var products = document.querySelectorAll('.product-card.catalogue-card, .product-card');
      if (products.length === 0) products = document.querySelectorAll('article.new-article, .container-card');
      debugInfo += ' | found=' + products.length;
      
      var seenLinks = {};
      var imgFoundCount = 0;
      for (var i = 0; i < products.length; i++) {
        try {
          var el = products[i];
          var a = el.querySelector('a.js_gtmonclick[href], a.article-link[href]');
          if (!a) a = el.querySelector('a[href*="/fr/"]');
          if (!a && el.tagName === 'A') a = el;
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href) continue;

          if (
            href.indexOf('/nos-boutiques/') >= 0 ||
            href.indexOf('/catalogue/?') >= 0 ||
            href.indexOf('/commander/') >= 0 ||
            href.indexOf('/ajax/') >= 0
          ) {
            continue;
          }

          var cleanHref = href.split('?')[0];
          var link = cleanHref.startsWith('http') ? cleanHref : 'https://www.label-emmaus.co' + cleanHref;
          if (seenLinks[link]) continue;
          seenLinks[link] = true;
          
          var title = '';
          var titleEl = el.querySelector('.product-title, .item-title, h2, h3, h4, [class*="title"], [class*="name"]');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imageUrl = '';
          var imgEl = el.querySelector('img.thumbnail-img, img.solo-img, .image-wrapper img, img[src], img[srcset]');
          if (imgEl) {
            imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';
            if (!imageUrl) {
              var srcset = imgEl.getAttribute('srcset') || '';
              if (srcset) imageUrl = srcset.split(',')[0].trim().split(' ')[0];
            }
            if (imageUrl && imageUrl.startsWith('/')) {
              imageUrl = 'https://www.label-emmaus.co' + imageUrl;
            }
          }
          if (imageUrl) imgFoundCount++;
          
          var price = '';
          var priceEl = el.querySelector('.product-price-default-color, .product-price-wrapper .h2, [class*="product-price"], [class*="price"], [class*="Price"]');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          if (!price) {
            var txt = el.innerText || '';
            var m = txt.match(/(\d[\d\s\u202F]*[.,]?\d*)\s*€/);
            if (m) price = m[0];
          }
          
          if (title && title.length > 3 && link && link.indexOf('/fr/') >= 0) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | imgFound=' + imgFoundCount + ' | FINAL_ITEMS=' + items.length;

    } else if (isZenMarket) {
      // === ZENMARKET / YAHOO JP ===
      var sel1 = document.querySelectorAll('[class*="item-card"], [class*="ItemCard"]').length;
      var sel2 = document.querySelectorAll('a[href*="/item/"], a[href*="/itempage/"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'ZenMarket: item-card=' + sel1 + ' | a-item=' + sel2 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var products = document.querySelectorAll('[class*="item-card"], [class*="ItemCard"]');
      if (products.length === 0) products = document.querySelectorAll('a[href*="/item/"], a[href*="/itempage/"]');
      debugInfo += ' | found=' + products.length;
      
      var seenLinks = {};
      for (var i = 0; i < products.length; i++) {
        try {
          var el = products[i];
          var a = el.tagName === 'A' ? el : el.querySelector('a[href]');
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : 'https://zenmarket.jp' + href;
          
          var title = '';
          var titleEl = el.querySelector('h2, h3, h4, [class*="title"], [class*="name"], span, p');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imgEl = el.querySelector('img');
          var imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
          
          var price = '';
          var priceEl = el.querySelector('[class*="price"], [class*="Price"]');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | FINAL_ITEMS=' + items.length;

    } else if (isStocklear) {
      // === STOCKLEAR ===
      var sel1 = document.querySelectorAll('[class*="product-card"], [class*="lot-card"]').length;
      var sel2 = document.querySelectorAll('a[href*="/lot/"], a[href*="/product/"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'Stocklear: product-card=' + sel1 + ' | a-lot=' + sel2 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var products = document.querySelectorAll('[class*="product-card"], [class*="lot-card"]');
      if (products.length === 0) products = document.querySelectorAll('a[href*="/lot/"], a[href*="/product/"]');
      debugInfo += ' | found=' + products.length;
      
      var seenLinks = {};
      for (var i = 0; i < products.length; i++) {
        try {
          var el = products[i];
          var a = el.tagName === 'A' ? el : el.querySelector('a[href]');
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : 'https://www.stocklear.fr' + href;
          
          var title = '';
          var titleEl = el.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imgEl = el.querySelector('img');
          var imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
          
          var price = '';
          var priceEl = el.querySelector('[class*="price"], [class*="Price"]');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | FINAL_ITEMS=' + items.length;

    } else if (isCatawiki) {
      // === CATAWIKI ===
      var sel1 = document.querySelectorAll('[class*="lot-card"], [class*="LotCard"]').length;
      var sel2 = document.querySelectorAll('a[href*="/l/"], a[href*="/lots/"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'Catawiki: lot-card=' + sel1 + ' | a-lots=' + sel2 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var lots = document.querySelectorAll('[class*="lot-card"], [class*="LotCard"]');
      if (lots.length === 0) lots = document.querySelectorAll('a[href*="/l/"], a[href*="/lots/"]');
      debugInfo += ' | found=' + lots.length;
      
      var seenLinks = {};
      for (var i = 0; i < lots.length; i++) {
        try {
          var el = lots[i];
          var a = el.tagName === 'A' ? el : el.querySelector('a[href*="/l/"], a[href*="/lots/"]');
          if (!a) a = el.querySelector('a[href]');
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : 'https://www.catawiki.com' + href;
          
          var title = '';
          var titleEl = el.querySelector('h3, h2, [class*="title"], [class*="lot-title"]');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imgEl = el.querySelector('img');
          var imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
          
          var price = '';
          var priceEl = el.querySelector('[class*="price"], [class*="bid"]');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | FINAL_ITEMS=' + items.length;

    } else if (isWallapop) {
      // === WALLAPOP ===
      var sel1 = document.querySelectorAll('[class*="ItemCard"], tsl-item-card').length;
      var sel2 = document.querySelectorAll('a[href*="/item/"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'Wallapop: ItemCard=' + sel1 + ' | a-item=' + sel2 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var cards = document.querySelectorAll('[class*="ItemCard"], tsl-item-card');
      if (cards.length === 0) cards = document.querySelectorAll('a[href*="/item/"]');
      debugInfo += ' | found=' + cards.length;
      
      var seenLinks = {};
      for (var i = 0; i < cards.length; i++) {
        try {
          var el = cards[i];
          var a = el.tagName === 'A' ? el : el.querySelector('a[href*="/item/"]');
          if (!a) a = el.querySelector('a[href]');
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : 'https://es.wallapop.com' + href;
          
          var title = '';
          var titleEl = el.querySelector('h2, h3, [class*="title"], [class*="ItemCard__title"]');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imgEl = el.querySelector('img');
          var imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
          
          var price = '';
          var priceEl = el.querySelector('[class*="price"], [class*="Price"], [class*="ItemCard__price"]');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | FINAL_ITEMS=' + items.length;

    } else if (isTroostwijk) {
      // === TROOSTWIJK ===
      var sel1 = document.querySelectorAll('[class*="lot-card"], [class*="LotCard"]').length;
      var sel2 = document.querySelectorAll('a[href*="/lot/"], a[href*="/lots/"]').length;
      var allDivs = document.querySelectorAll('div').length;
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      debugInfo = 'Troostwijk: lot-card=' + sel1 + ' | a-lot=' + sel2 + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      var lots = document.querySelectorAll('[class*="lot-card"], [class*="LotCard"]');
      if (lots.length === 0) lots = document.querySelectorAll('a[href*="/lot/"], a[href*="/lots/"]');
      debugInfo += ' | found=' + lots.length;
      
      var seenLinks = {};
      for (var i = 0; i < lots.length; i++) {
        try {
          var el = lots[i];
          var a = el.tagName === 'A' ? el : el.querySelector('a[href*="/lot/"]');
          if (!a) a = el.querySelector('a[href]');
          var href = a ? (a.getAttribute('href') || '') : '';
          if (!href || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : 'https://www.troostwijkauctions.com' + href;
          
          var title = '';
          var titleEl = el.querySelector('h2, h3, h4, [class*="title"], [class*="lot-name"]');
          if (titleEl) title = titleEl.innerText ? titleEl.innerText.trim() : '';
          if (!title && a) title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          
          var imgEl = el.querySelector('img');
          var imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
          
          var price = '';
          var priceEl = el.querySelector('[class*="price"], [class*="bid"]');
          if (priceEl) price = priceEl.innerText ? priceEl.innerText.trim() : '';
          
          if (title && title.length > 3 && link) {
            items.push({ title: title.substring(0, 150), price: price || 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | FINAL_ITEMS=' + items.length;

    } else if (isLeboncoin) {
      // === LEBONCOIN ===
      var selectors = [
        '[data-qa-id="aditem_container"]',
        '[class*="AdCard"]',
        '[class*="aditem"]',
        'a[href*="/ad/"]',
        'article',
        '[class*="item-card"]'
      ];
      var cards = document.querySelectorAll(selectors.join(', '));
      debugInfo = 'Leboncoin: ' + cards.length + ' cards';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: 'LEBONCOIN: cards=' + cards.length + ' | url=' + loc }));
      
      if (cards.length === 0) {
        cards = document.querySelectorAll('[class*="card"], [class*="item"]');
      }
      
      var seen = {};
      for (var i = 0; i < Math.min(cards.length, 30); i++) {
        try {
          var card = cards[i];
          var title = '';
          var price = '';
          var link = '';
          var img = '';
          
          // Titre
          var titleEls = card.querySelectorAll('h2, h3, h4, span, p');
          for (var t = 0; t < titleEls.length; t++) {
            var txt = titleEls[t].innerText.trim();
            if (txt.length > 3 && txt.length < 200 && !txt.match(/€/) && !txt.match(/^https/)) {
              title = txt;
              break;
            }
          }
          
          // Prix
          var priceEls = card.querySelectorAll('[class*="price"], span, p, div');
          for (var p = 0; p < priceEls.length; p++) {
            var ptxt = priceEls[p].innerText.trim();
            if (ptxt.match(/^\\d+[.,\\d]*\\s*€/) && ptxt.length < 30) {
              price = ptxt;
              break;
            }
          }
          
          // Lien
          var linkEl = card.tagName === 'A' ? card : card.querySelector('a[href]');
          if (linkEl && linkEl.href) link = linkEl.href;
          
          // Image
          var imgEl = card.querySelector('img[src]');
          if (imgEl) img = imgEl.src || imgEl.dataset.src || '';
          if (!img) {
            var allImgs = card.querySelectorAll('img');
            for (var im = 0; im < allImgs.length; im++) {
              var imgSrc = allImgs[im].src || allImgs[im].dataset.src || '';
              if (imgSrc && imgSrc.length > 10) { img = imgSrc; break; }
            }
          }
          
          var key = title + price;
          if ((title || price) && !seen[key]) {
            seen[key] = true;
            items.push({ title: title || 'Unknown', price: price || 'N/A', link: link || '', image: img || '' });
          }
        } catch(e) {}
      }
    } else {
      // === SITE NON RECONNU (fallback générique) ===
      var allAs = document.querySelectorAll('a').length;
      var allImgs = document.querySelectorAll('img').length;
      var allDivs = document.querySelectorAll('div').length;
      debugInfo = 'UNKNOWN_SITE: url=' + loc + ' | divs=' + allDivs + ' | as=' + allAs + ' | imgs=' + allImgs;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extractDebug', message: debugInfo }));
      
      // Try generic: grab all links with images nearby
      var allLinks = document.querySelectorAll('a[href]');
      var seenLinks = {};
      for (var i = 0; i < Math.min(allLinks.length, 50); i++) {
        try {
          var a = allLinks[i];
          var href = a.getAttribute('href') || '';
          if (href.length < 5 || href === '#' || seenLinks[href]) continue;
          seenLinks[href] = true;
          var link = href.startsWith('http') ? href : loc.split('/').slice(0,3).join('/') + href;
          
          var imgEl = a.querySelector('img');
          var imageUrl = imgEl ? (imgEl.getAttribute('src') || '') : '';
          
          var title = a.innerText ? a.innerText.trim().substring(0, 100) : '';
          if (!title && imgEl) title = imgEl.getAttribute('alt') || '';
          
          if (title && title.length > 5 && imageUrl) {
            items.push({ title: title, price: 'N/A', link: link, image: imageUrl });
          }
        } catch(e) {}
      }
      debugInfo += ' | FINAL_ITEMS=' + items.length;
    }
    
    debugInfo += ' | Items: ' + items.length;
    
    var pageTitle = document.title || '';
    var metaDesc = '';
    var metaEl = document.querySelector('meta[name="description"]');
    if (metaEl) metaDesc = metaEl.getAttribute('content') || '';
    
    var bodyText = document.body ? document.body.innerText : '';
    bodyText = bodyText.replace(/\\s+/g, ' ').substring(0, 8000);
    
    var result = {
      type: 'content',
      url: window.location.href,
      pageTitle: pageTitle,
      metaDescription: metaDesc,
      items: items,
      bodyText: bodyText,
      debug: debugInfo
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(result));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ 
      type: 'content', 
      error: e.message, 
      url: window.location.href, 
      items: [], 
      bodyText: document.body ? document.body.innerText.substring(0, 8000) : '', 
      pageTitle: document.title || '',
      debug: 'Error: ' + e.message
    }));
  }
})();
true;
`;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

async function fetchPageContentWeb(pageUrl: string): Promise<string> {
  console.log('[Browse] Fetching page content for web:', pageUrl);
  
  // 1. Essai direct d'abord (plus discret, pas de proxy détectable)
  try {
    console.log('[Browse] Trying direct fetch...');
    const response = await fetch(pageUrl, { 
      signal: AbortSignal.timeout(8000),
      mode: 'cors',
    });
    if (response.ok) {
      const html = await response.text();
      if (html && html.length > 100) {
        console.log(`[Browse] Direct fetch success, ${html.length} chars`);
        return parseHtmlToContent(html, pageUrl);
      }
    } else {
      console.log(`[Browse] Direct fetch returned ${response.status}`);
    }
  } catch (e: any) {
    console.log(`[Browse] Direct fetch failed: ${e?.message ?? e}`);
  }

  // 2. Essai no-cors (moins de données mais plus discret)
  try {
    console.log('[Browse] Trying no-cors fetch...');
    const response = await fetch(pageUrl, { 
      signal: AbortSignal.timeout(8000),
      mode: 'no-cors',
    });
    const html = await response.text();
    if (html && html.length > 100) {
      console.log(`[Browse] No-cors fetch got ${html.length} chars`);
      return parseHtmlToContent(html, pageUrl);
    }
  } catch (e: any) {
    console.log(`[Browse] No-cors fetch failed: ${e?.message ?? e}`);
  }

  // 3. Proxies en dernier recours (plus détectable)
  for (const proxy of CORS_PROXIES) {
    try {
      const fetchUrl = proxy + encodeURIComponent(pageUrl);
      console.log(`[Browse] Trying proxy: ${proxy.substring(0, 40)}...`);
      const response = await fetch(fetchUrl, { 
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        console.log(`[Browse] Proxy returned ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      if (!html || html.length < 100) {
        console.log(`[Browse] Proxy returned too short response: ${html?.length ?? 0} chars`);
        continue;
      }
      
      console.log(`[Browse] Web fetch SUCCESS via proxy, ${html.length} chars`);
      const content = parseHtmlToContent(html, pageUrl);
      console.log(`[Browse] Parsed content: ${content.length} chars`);
      return content;
    } catch (e: any) {
      console.log(`[Browse] Proxy failed: ${e?.message ?? e}`);
    }
  }

  console.log('[Browse] ALL fetch methods failed for', pageUrl);
  return '';
}

function parseHtmlToContent(html: string, pageUrl: string): string {
  let content = `URL: ${pageUrl}\n`;
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    content += `Page: ${titleMatch[1].trim()}\n`;
  }
  
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (metaMatch) {
    content += `Description: ${metaMatch[1].trim()}\n`;
  }
  
  content += '\nContenu extrait:\n';
  
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&amp;/g, '&')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const pricePattern = /\d+[.,]?\d*\s*€|€\s*\d+[.,]?\d*/g;
  const prices = text.match(pricePattern);
  if (prices && prices.length > 0) {
    content += `\nPrix détectés: ${prices.slice(0, 30).join(', ')}\n`;
  }

  const imgMatches: string[] = [];
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null && imgMatches.length < 15) {
    const src = imgMatch[1];
    if (src && !src.includes('data:') && !src.includes('pixel') && !src.includes('tracking') && src.length > 20) {
      imgMatches.push(src);
    }
  }
  if (imgMatches.length > 0) {
    content += `\nImages produits: ${imgMatches.join('\n')}\n`;
  }
  
  const linkMatches: string[] = [];
  const linkRegex = /<a[^>]*href=["']([^"']*(?:annonce|item|product|listing|offre)[^"']*)["'][^>]*/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null && linkMatches.length < 20) {
    linkMatches.push(linkMatch[1]);
  }
  if (linkMatches.length > 0) {
    content += `\nLiens annonces: ${linkMatches.join('\n')}\n`;
  }
  
  content += `\nTexte de la page:\n${text.substring(0, 8000)}`;
  
  console.log(`[Browse] Parsed content: ${content.length} chars, ${prices?.length ?? 0} prices, ${imgMatches.length} images, ${linkMatches.length} links`);
  return content;
}

let WebViewComponent: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
  try {
    WebViewComponent = require('react-native-webview').default;
  } catch (e) {
    console.log('[Browse] WebView not available');
  }
}

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { url, name, source } = useLocalSearchParams<{
    url: string;
    name: string;
    source: string;
  }>();

  const { startScan, stopScan, isAnalyzing, lastScanResults, scanError, settings } = usePepite();

  const [scanning, setScanning] = useState<boolean>(false);
  const [scanTime, setScanTime] = useState<number>(0);
  const [pageLoaded, setPageLoaded] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [showScanTutorial, setShowScanTutorial] = useState<boolean>(true);
  const [dontShowTutorialAgain, setDontShowTutorialAgain] = useState<boolean>(false);
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  const [currentTipIndex, setCurrentTipIndex] = useState<number>(0);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [screenshotCount, setScreenshotCount] = useState<number>(0);
  const [contentExtracted, setContentExtracted] = useState<boolean>(false);

  const tipFadeAnim = useRef(new Animated.Value(1)).current;
  const analysisProgressAnim = useRef(new Animated.Value(0)).current;

  const webViewRef = useRef<any>(null);
  const webViewContainerRef = useRef<View>(null);
  const isCapturingRef = useRef<boolean>(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanBarAnim = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const dotRef = useRef<Animated.CompositeAnimation | null>(null);
  const extractedContentRef = useRef<string>('');
  const scanTimeRef = useRef<number>(0);
  const screenshotsRef = useRef<string[]>([]);
  const extractedItemsRef = useRef<Array<{title: string; link: string; image: string; price: string}>>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const scanningRef = useRef<boolean>(false);

  // Nettoyage de tous les timers à la destruction du composant
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  // Charger la préférence du tutorial au mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('scan_tutorial_hidden');
        if (stored === 'true') {
          setShowScanTutorial(false);
        }
      } catch (e) {
        console.log('[Browse] Error loading tutorial preference:', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (scanning) {
      const interval = setInterval(() => {
        setScanTime((t) => {
          const next = t + 1;
          scanTimeRef.current = next;
          return next;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [scanning]);

  useEffect(() => {
    if (scanning && scanTime >= SCAN_DURATION_LIMIT) {
      console.log(`[Browse] Auto-stop: ${SCAN_DURATION_LIMIT}s reached`);
      doStopScan();
    }
  }, [scanning, scanTime]);

  // Limite stricte de 30 secondes : arrêt forcé sans exception
  useEffect(() => {
    if (scanning) {
      const hardStopTimeout = setTimeout(() => {
        console.log('[Browse] ⚠️ HARD STOP: 30s limit reached, forcing scan termination');
        // Arrêter le scroll
        if (Platform.OS !== 'web' && webViewRef.current) {
          try {
            webViewRef.current.injectJavaScript(STOP_SCROLL_SCRIPT);
          } catch (e) {}
        }
        scanningRef.current = false;
        setScanning(false);
        // Annuler tous les timers planifiés
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
        // Finaliser immédiatement
        setShowResults(true);
        overlayFade.setValue(0);
        stopScan(name ?? 'Shopping', extractedContentRef.current, [...screenshotsRef.current], [...extractedItemsRef.current]);
      }, SCAN_DURATION_LIMIT * 1000);
      return () => clearTimeout(hardStopTimeout);
    }
  }, [scanning, name, stopScan]);

  // Planification récursive des captures avec délai aléatoire
  const scheduleNextCapture = useCallback(() => {
    if (!scanningRef.current || screenshotsRef.current.length >= MAX_SCREENSHOTS) return;
    const delay = Math.random() * (MAX_SCREENSHOT_INTERVAL - MIN_SCREENSHOT_INTERVAL) + MIN_SCREENSHOT_INTERVAL;
    const timeout = setTimeout(() => {
      if (!scanningRef.current) return;
      captureScreenshot();
      scheduleNextCapture();
    }, delay) as any;
    timeoutsRef.current.push(timeout);
  }, []);

  // Planification récursive des extractions avec délai aléatoire
  const scheduleNextExtract = useCallback(() => {
    if (!scanningRef.current) return;
    const delay = Math.random() * (MAX_EXTRACT_INTERVAL - MIN_EXTRACT_INTERVAL) + MIN_EXTRACT_INTERVAL;
    const timeout = setTimeout(() => {
      if (!scanningRef.current) return;
      extractPageContent();
      scheduleNextExtract();
    }, delay) as any;
    timeoutsRef.current.push(timeout);
  }, []);

  useEffect(() => {
    if (scanning) {
      const tipInterval = setInterval(() => {
        Animated.timing(tipFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          setCurrentTipIndex((prev) => (prev + 1) % SCAN_TIPS.length);
          Animated.timing(tipFadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        });
      }, 4000);

      return () => {
        clearInterval(tipInterval);
      };
    }
  }, [scanning]);

  useEffect(() => {
    if (scanning) {
      const p = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      p.start();
      pulseRef.current = p;

      const d = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      d.start();
      dotRef.current = d;

      Animated.timing(scanBarAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();

      return () => {
        p.stop();
        d.stop();
      };
    } else {
      Animated.timing(scanBarAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  }, [scanning]);

  useEffect(() => {
    if (showResults && isAnalyzing) {
      setAnalysisStep(0);
      analysisProgressAnim.setValue(0);
      Animated.timing(overlayFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();

      Animated.timing(analysisProgressAnim, {
        toValue: 0.9,
        duration: 25000,
        useNativeDriver: false,
      }).start();

      const stepInterval = setInterval(() => {
        setAnalysisStep((prev) => {
          if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 4000);

      return () => clearInterval(stepInterval);
    }
  }, [showResults, isAnalyzing]);

  useEffect(() => {
    if (showResults && !isAnalyzing && lastScanResults.length > 0) {
      console.log(`[Browse] Analysis complete: ${lastScanResults.length} pepites found`);
      analysisProgressAnim.setValue(1);
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
    }
  }, [isAnalyzing, lastScanResults, showResults]);

  useEffect(() => {
    if (showResults && !isAnalyzing && lastScanResults.length === 0 && !scanError) {
      analysisProgressAnim.setValue(1);
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
    }
  }, [isAnalyzing, lastScanResults, showResults, scanError]);

  useEffect(() => {
    if (showResults && scanError) {
      console.log('[Browse] Scan error:', scanError);
      analysisProgressAnim.setValue(1);
    }
  }, [scanError, showResults]);



  const captureScreenshot = useCallback(async () => {
    if (Platform.OS === 'web' || !webViewContainerRef.current || isCapturingRef.current || screenshotsRef.current.length >= MAX_SCREENSHOTS) return;
    isCapturingRef.current = true;
    try {
      const base64 = await captureRef(webViewContainerRef, {
        format: 'jpg',
        quality: 0.5,
        result: 'base64',
      });
      if (base64 && base64.length > 500) {
        screenshotsRef.current.push(base64);
        const count = screenshotsRef.current.length;
        setScreenshotCount(count);
        console.log(`[Browse] ✅ Native screenshot captured: frame ${count}/${MAX_SCREENSHOTS}, ${Math.round(base64.length / 1024)}KB`);
      } else {
        console.log(`[Browse] Screenshot too small: ${base64?.length ?? 0} bytes`);
      }
    } catch (e) {
      console.log('[Browse] Native capture failed:', e);
    } finally {
      isCapturingRef.current = false;
    }
  }, []);

  const extractPageContent = useCallback(() => {
    if (Platform.OS !== 'web' && webViewRef.current) {
      try {
        webViewRef.current.injectJavaScript(CONTENT_EXTRACT_JS);
        console.log('[Browse] Injected content extraction JS');
      } catch (e) {
        console.log('[Browse] Failed to inject JS:', e);
      }
    }
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'extractDebug') {
        console.log(`[Browse] [EXTRACT_DEBUG] ${data.message}`);
        if (data.url) console.log(`[Browse] [EXTRACT_DEBUG] URL: ${data.url}`);
        return;
      }

      if (data.type === 'content' || data.items) {
        console.log(`[Browse] Extracted: ${data.items?.length ?? 0} items from ${data.pageTitle}`);
        if (data.debug) {
          console.log(`[Browse] [DEBUG] ${data.debug}`);
        }
        if (data.error) {
          console.log(`[Browse] [ERROR] ${data.error}`);
        }

        // Store raw items for later URL enrichment
        if (data.items && data.items.length > 0) {
          extractedItemsRef.current = data.items.map((item: any) => ({
            title: item.title || '',
            link: item.link || '',
            image: item.image || '',
            price: item.price || '',
          }));
          console.log(`[Browse] 📦 Stored ${extractedItemsRef.current.length} items in ref for enrichment`);
          extractedItemsRef.current.forEach((item, idx) => {
            console.log(`[Browse]   Item #${idx+1}: "${item.title}" | Link: ${item.link ? '✓' : '✗'} | Image: ${item.image ? '✓' : '✗'}`);
          });
        }

        let content = `Page: ${data.pageTitle}\nURL: ${data.url}\n`;
        if (data.metaDescription) {
          content += `Description: ${data.metaDescription}\n`;
        }
        content += '\nAnnonces trouvées:\n';

        if (data.items && data.items.length > 0) {
          data.items.forEach((item: any, i: number) => {
            content += `\n--- Annonce ${i + 1} ---\n`;
            if (item.title) content += `Titre: ${item.title}\n`;
            if (item.price) content += `Prix: ${item.price}\n`;
            if (item.link) content += `Lien: ${item.link}\n`;
            if (item.image) content += `Image: ${item.image}\n`;
          });
          console.log(`[Browse] ℹ️ Items with links/images: ${data.items.filter((i: any) => i.link || i.image).length}`);
        }

        if (data.bodyText) {
          content += `\nContenu de la page:\n${data.bodyText.substring(0, 5000)}`;
        }

        if (content.length > extractedContentRef.current.length) {
          extractedContentRef.current = content;
          setExtractedContent(content);
          setContentExtracted(true);
          console.log(`[Browse] ✅ Content updated: ${content.length} chars, ${data.items?.length ?? 0} items`);
        } else {
          console.log(`[Browse] Content not updated (existing ${extractedContentRef.current.length} >= new ${content.length})`);
        }
      }
    } catch (e) {
      console.log('[Browse] Failed to parse WebView message:', e);
    }
  }, []);

  const fetchWebContent = useCallback(async () => {
    if (Platform.OS === 'web' && url) {
      console.log('[Browse] === Web platform: fetching page content via proxy ===');
      console.log('[Browse] URL:', url);
      try {
        const content = await fetchPageContentWeb(url);
        if (content && content.length > 50) {
          extractedContentRef.current = content;
          setExtractedContent(content);
          console.log(`[Browse] ✅ Web content fetched: ${content.length} chars`);
          console.log(`[Browse] Content preview: ${content.substring(0, 200)}`);
        } else {
          console.log('[Browse] ⚠️ Web content fetch returned insufficient data:', content?.length ?? 0, 'chars');
        }
      } catch (e: any) {
        console.log('[Browse] ❌ Web content fetch error:', e?.message ?? e);
      }
    }
  }, [url]);

  const handleStartScan = useCallback(() => {
    if (!settings.geminiApiKey || settings.geminiApiKey.trim().length === 0) {
      Alert.alert(
        'Clé API requise',
        'Configurez votre clé API Gemini dans Réglages > Clé API pour activer le scan.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Configurer', onPress: () => router.push('/settings/api-key' as any) },
        ]
      );
      return;
    }

    // Afficher le tutorial si pas encore caché
    if (showScanTutorial) {
      setShowScanTutorial(true);
      return;
    }

    // Sinon, démarrer directement le scan
    startActualScan();
  }, [settings.geminiApiKey, showScanTutorial, router]);

  const startActualScan = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    console.log(`[Browse] Starting VIDEO scan on ${name}`);
    setScanning(true);
    scanningRef.current = true;
    setScanTime(0);
    scanTimeRef.current = 0;
    setExtractedContent('');
    extractedContentRef.current = '';
    screenshotsRef.current = [];
    extractedItemsRef.current = [];
    setScreenshotCount(0);
    setContentExtracted(false);
    setCurrentTipIndex(0);
    // Nettoyer les anciens timers
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    startScan();

    // Injection du script de scroll pour imiter un humain (native uniquement)
    if (Platform.OS !== 'web' && webViewRef.current) {
      const scrollTimeout = setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(SCROLL_SCRIPT);
          console.log('[Browse] Scroll simulation injected');
        }
      }, 2000) as any;
      timeoutsRef.current.push(scrollTimeout);
    }

    // Délai initial aléatoire avant la première capture et extraction
    // Augmenté pour Vinted qui charge dynamiquement
    const firstCaptureDelay = Math.random() * 1500 + 3000; // 3 à 4.5 secondes
    const firstExtractDelay = Math.random() * 2000 + 4000; // 4 à 6 secondes

    if (Platform.OS === 'web') {
      console.log('[Browse] Web: starting content fetch loop with random intervals');
      // Boucle récursive avec délai aléatoire pour le web
      const fetchWebLoop = async () => {
        if (!scanningRef.current) return;
        console.log('[Browse] Web: fetching content...');
        await fetchWebContent();
        if (scanningRef.current) {
          const nextDelay = Math.random() * 6000 + 4000; // 4 à 10 secondes
          const t = setTimeout(fetchWebLoop, nextDelay) as any;
          timeoutsRef.current.push(t);
        }
      };
      const t = setTimeout(fetchWebLoop, firstExtractDelay) as any;
      timeoutsRef.current.push(t);
    } else {
      // Planification avec délais aléatoires (native)
      const capT = setTimeout(() => {
        if (!scanningRef.current) return;
        captureScreenshot();
        scheduleNextCapture();
      }, firstCaptureDelay) as any;
      timeoutsRef.current.push(capT);

      const extT = setTimeout(() => {
        if (!scanningRef.current) return;
        extractPageContent();
        scheduleNextExtract();
      }, firstExtractDelay) as any;
      timeoutsRef.current.push(extT);
    }

    console.log(`[Browse] First capture in ${Math.round(firstCaptureDelay)}ms, first extract in ${Math.round(firstExtractDelay)}ms`);
  }, [startScan, name, url, source, extractPageContent, fetchWebContent, captureScreenshot, scheduleNextCapture, scheduleNextExtract]);

  const doStopScan = useCallback(async () => {
    console.log('[Browse] === doStopScan called ===');
    
    // Arrêter le scroll immédiatement
    if (Platform.OS !== 'web' && webViewRef.current) {
      try {
        webViewRef.current.injectJavaScript(STOP_SCROLL_SCRIPT);
        console.log('[Browse] Scroll stopped');
      } catch (e) {
        console.log('[Browse] Failed to stop scroll:', e);
      }
    }

    // Arrêter le flag de scan et annuler tous les timers planifiés
    scanningRef.current = false;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const hapticT = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 100) as any;
      timeoutsRef.current.push(hapticT);
      // Capture finale après un petit délai aléatoire
      const finalCaptureDelay = Math.random() * 500 + 200;
      await new Promise<void>((resolve) => {
        const captureT = setTimeout(() => {
          captureScreenshot();
          extractPageContent();
          console.log('[Browse] Final capture triggered before stop');
          resolve();
        }, finalCaptureDelay) as any;
        timeoutsRef.current.push(captureT);
      });
    } else {
      console.log('[Browse] Web: doing final content fetch before stop...');
      await fetchWebContent();
    }

    // Délai aléatoire avant finalisation (600-1000ms)
    const finalDelay = Math.random() * 400 + 600;
    const finalT = setTimeout(() => {
      const merchantName = name ?? 'Shopping';
      let content = extractedContentRef.current;
      const screenshots = [...screenshotsRef.current];

      console.log('[Browse] ============ SCAN STOP SUMMARY ============');
      console.log(`[Browse] Merchant: ${merchantName}`);
      console.log(`[Browse] Platform: ${Platform.OS}`);
      console.log(`[Browse] Scan duration: ${scanTimeRef.current}s`);
      console.log(`[Browse] Screenshots captured: ${screenshots.length}`);
      console.log(`[Browse] Text content length: ${content.length} chars`);
      if (screenshots.length > 0) {
        console.log(`[Browse] Total screenshot data: ${Math.round(screenshots.reduce((s, f) => s + f.length, 0) / 1024)}KB`);
      }
      if (content.length > 0) {
        console.log(`[Browse] Content preview: ${content.substring(0, 300)}`);
      }

      if (content.length === 0 && screenshots.length === 0) {
        console.warn('[Browse] ⚠️ WARNING: No content and no screenshots captured!');
        console.log('[Browse] Building fallback context from URL and merchant info...');
        content = `URL analysée: ${url ?? 'inconnue'}\nMarchand: ${merchantName}\nPlateforme: ${source ?? 'inconnue'}\n\nATTENTION: Le contenu de la page n'a pas pu être extrait (restrictions cross-origin). L'analyse est basée uniquement sur l'URL fournie. Si tu ne peux pas analyser le contenu réel, retourne {"pepites": []}.`;
        extractedContentRef.current = content;
        console.log('[Browse] Fallback content created:', content.length, 'chars');
      }

      console.log('[Browse] ============ SENDING TO GEMINI ============');
      console.log(`[Browse] Mode: ${screenshots.length > 0 ? 'VIDEO (' + screenshots.length + ' frames)' : 'TEXT-ONLY'}`);
      console.log(`[Browse] Items to pass: ${extractedItemsRef.current.length} items`);
      if (extractedItemsRef.current.length > 0) {
        console.log('[Browse] Items being sent to enrichment:');
        extractedItemsRef.current.forEach((item, idx) => {
          console.log(`[Browse]   #${idx+1}: "${item.title}" | ${item.price}`);
        });
      }
      
      setScanning(false);
      setShowResults(true);
      overlayFade.setValue(0);
      stopScan(merchantName, content, screenshots, [...extractedItemsRef.current]);
    }, finalDelay) as any;
    timeoutsRef.current.push(finalT);
  }, [stopScan, name, url, source, extractPageContent, fetchWebContent, captureScreenshot]);

  const handleStopScan = useCallback(() => {
    doStopScan();
  }, [doStopScan]);

  const handleViewResults = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleBack = useCallback(() => {
    if (scanning) {
      handleStopScan();
    } else {
      router.back();
    }
  }, [scanning, router, handleStopScan]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const scanBarHeight = scanBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  const progressPercent = Math.min((scanTime / SCAN_DURATION_LIMIT) * 100, 100);
  const totalProfit = lastScanResults.reduce((sum, p) => sum + p.profit, 0);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.urlBar}>
          <Shield size={12} color={Colors.success} />
          <Text style={styles.urlText} numberOfLines={1}>
            {name ?? 'Navigation'}
          </Text>
        </View>

        {!scanning ? (
          <TouchableOpacity
            style={styles.scanStartBtn}
            onPress={handleStartScan}
            activeOpacity={0.8}
            testID="start-scan-btn"
          >
            <Video size={16} color="#000" />
            <Text style={styles.scanStartText}>SCAN</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.scanStopBtn}
              onPress={handleStopScan}
              activeOpacity={0.8}
              testID="stop-scan-btn"
            >
              <Square size={14} color="#fff" />
              <Text style={styles.scanStopText}>STOP</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <Animated.View style={[styles.scanIndicatorBar, { height: scanBarHeight }]}>
        {scanning && (
          <View style={styles.scanIndicatorContent}>
            <View style={styles.scanIndicatorLeft}>
              <Animated.View style={[styles.recDotSmall, { opacity: dotOpacity }]} />
              <Text style={styles.scanIndicatorText}>
                REC · {formatTime(scanTime)}
              </Text>
            </View>
            <View style={styles.scanMeta}>
              <Animated.Text style={[styles.tipText, { opacity: tipFadeAnim }]} numberOfLines={1}>
                {SCAN_TIPS[currentTipIndex]}
              </Animated.Text>
              <View style={styles.progressMini}>
                <View style={[styles.progressMiniFill, { width: `${progressPercent}%` as any }]} />
              </View>
            </View>
          </View>
        )}
      </Animated.View>

      <View style={styles.webviewContainer}>
        {Platform.OS !== 'web' && WebViewComponent ? (
          <View ref={webViewContainerRef} style={styles.webviewInner} collapsable={false}>
          <WebViewComponent
            ref={webViewRef}
            source={{ uri: url ?? 'https://www.leboncoin.fr' }}
            style={styles.webview}
            userAgent={WEBVIEW_USER_AGENT}
            onLoadEnd={() => {
              console.log('[Browse] Page loaded');
              setPageLoaded(true);
              // L'extraction sera déclenchée par le scan, pas au chargement
            }}
            onMessage={handleWebViewMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.loadingText}>Chargement de {name}...</Text>
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
          />
          </View>
        ) : (
          <View style={styles.webFallback}>
            {Platform.OS === 'web' ? (
              <iframe
                src={url ?? 'https://www.leboncoin.fr'}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#fff',
                } as any}
                onLoad={() => setPageLoaded(true)}
              />
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.loadingText}>Chargement...</Text>
              </View>
            )}
          </View>
        )}

        {scanning && (
          <View style={styles.scanOverlayEdge} pointerEvents="none">
            <View style={styles.scanEdgeTop} />
            <View style={styles.scanEdgeBottom} />
            <View style={styles.scanEdgeLeft} />
            <View style={styles.scanEdgeRight} />
            <View style={styles.recBadgeOverlay}>
              <View style={styles.recBadge}>
                <View style={styles.recBadgeDot} />
                <Text style={styles.recBadgeText}>REC</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {showResults && (
        <Animated.View style={[styles.resultsOverlay, { opacity: overlayFade }]}>
          <View style={styles.resultsCard}>
            {isAnalyzing ? (
              <View style={styles.analyzingContainer}>
                <Text style={styles.analyzingEmoji}>🧠</Text>
                <Text style={styles.analyzingText}>Analyse en cours...</Text>

                <View style={styles.analysisProgressBar}>
                  <Animated.View
                    style={[
                      styles.analysisProgressFill,
                      {
                        width: analysisProgressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>

                <View style={styles.analysisSteps}>
                  {ANALYSIS_STEPS.map((step, i) => {
                    const isActive = i === analysisStep;
                    const isDone = i < analysisStep;
                    return (
                      <View key={i} style={styles.analysisStepRow}>
                        <View style={[
                          styles.stepDot,
                          isDone && styles.stepDotDone,
                          isActive && styles.stepDotActive,
                        ]}>
                          {isDone ? (
                            <CheckCircle size={14} color={Colors.success} />
                          ) : isActive ? (
                            <ActivityIndicator size="small" color={Colors.gold} />
                          ) : (
                            <View style={styles.stepDotEmpty} />
                          )}
                        </View>
                        <Text style={[
                          styles.stepLabel,
                          isDone && styles.stepLabelDone,
                          isActive && styles.stepLabelActive,
                        ]}>
                          {step}
                        </Text>
                      </View>
                    );
                  })}
                </View>


              </View>
            ) : scanError ? (
              <View style={styles.resultContent}>
                <Text style={styles.resultEmoji}>⚠️</Text>
                <Text style={styles.resultTitle}>Erreur</Text>
                <Text style={styles.resultSubtext}>{scanError}</Text>
                <TouchableOpacity
                  style={styles.resultActionBtn}
                  onPress={() => {
                    setShowResults(false);
                    overlayFade.setValue(0);
                  }}
                >
                  <Text style={styles.resultActionText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            ) : lastScanResults.length === 0 ? (
              <View style={styles.resultContent}>
                <Text style={styles.resultEmoji}>🔍</Text>
                <Text style={styles.resultTitle}>Aucune pépite</Text>
                <Text style={styles.resultSubtext}>
                  Aucune bonne affaire détectée cette fois. Essayez de naviguer vers plus d'annonces.
                </Text>
                <TouchableOpacity
                  style={styles.resultActionBtn}
                  onPress={() => {
                    setShowResults(false);
                    overlayFade.setValue(0);
                  }}
                >
                  <Text style={styles.resultActionText}>Continuer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resultContent}>
                <Text style={styles.resultEmoji}>💰</Text>
                <Text style={styles.resultTitle}>
                  {lastScanResults.length} pépite{lastScanResults.length > 1 ? 's' : ''} trouvée{lastScanResults.length > 1 ? 's' : ''} !
                </Text>
                <Text style={styles.resultProfit}>
                  +{totalProfit.toLocaleString('fr-FR')}€ de profit potentiel
                </Text>

                <View style={styles.resultsList}>
                  {lastScanResults.slice(0, 3).map((p) => (
                    <View key={p.id} style={styles.resultRow}>
                      <Text style={styles.resultRowTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.resultRowProfit}>+{p.profit.toLocaleString('fr-FR')}€</Text>
                    </View>
                  ))}
                  {lastScanResults.length > 3 && (
                    <Text style={styles.moreText}>
                      +{lastScanResults.length - 3} autre{lastScanResults.length - 3 > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.resultActionBtn}
                  onPress={handleViewResults}
                  testID="view-results-btn"
                >
                  <Zap size={16} color="#000" />
                  <Text style={styles.resultActionText}>Voir les résultats</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => {
                    setShowResults(false);
                    overlayFade.setValue(0);
                  }}
                >
                  <Text style={styles.continueBtnText}>Continuer à naviguer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* Tutorial Modal Carousel */}
      <Modal
        visible={showScanTutorial}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScanTutorial(false)}
      >
        <View style={styles.tutorialOverlay}>
          <View style={styles.tutorialModal}>
            {/* Header with Title */}
            <View style={styles.tutorialHeader}>
              <Text style={styles.tutorialTitle}>✨ Guide de Scan</Text>
              <Text style={styles.tutorialSubtitle}>Étape {currentSlide + 1} sur 4</Text>
            </View>

            {/* Carousel Slides */}
            <View style={styles.carouselContainer}>
              {/* Slide 1: Recherche */}
              {currentSlide === 0 && (
                <View style={styles.slide}>
                  <View style={styles.slideIconContainer}>
                    <Text style={styles.slideIcon}>🔍</Text>
                  </View>
                  <Text style={styles.slideTitle}>Recherche Pertinente</Text>
                  <Text style={styles.slideText}>
                    Assurez-vous d'avoir une bonne recherche ou catégorie active sur le site en question. Plus la sélection est ciblée, meilleures seront les pépites trouvées.
                  </Text>
                </View>
              )}

              {/* Slide 2: Lancer le Scan */}
              {currentSlide === 1 && (
                <View style={styles.slide}>
                  <View style={styles.slideIconContainer}>
                    <Text style={styles.slideIcon}>🚀</Text>
                  </View>
                  <Text style={styles.slideTitle}>Lancez le Scan</Text>
                  <Text style={styles.slideText}>
                    Cliquez sur le bouton SCAN et ne touchez plus à l'écran. L'application va automatiquement capturer et analyser les articles.
                  </Text>
                </View>
              )}

              {/* Slide 3: Laisser Faire */}
              {currentSlide === 2 && (
                <View style={styles.slide}>
                  <View style={styles.slideIconContainer}>
                    <Text style={styles.slideIcon}>☕</Text>
                  </View>
                  <Text style={styles.slideTitle}>Laissez Faire l'App</Text>
                  <Text style={styles.slideText}>
                    Pépite prend les captures et analyse automatiquement. Vous pouvez vous détendre pendant ce temps et laisser l'IA faire son travail.
                  </Text>
                </View>
              )}

              {/* Slide 4: Résultats */}
              {currentSlide === 3 && (
                <View style={styles.slide}>
                  <View style={styles.slideIconContainer}>
                    <Text style={styles.slideIcon}>💎</Text>
                  </View>
                  <Text style={styles.slideTitle}>Récupérez les Résultats</Text>
                  <Text style={styles.slideText}>
                    Une fois le scan terminé, cliquez sur "Voir les résultats" pour accéder à toutes les pépites trouvées avec leurs marges estimées.
                  </Text>
                </View>
              )}
            </View>

            {/* Progress Dots */}
            <View style={styles.progressDots}>
              {[0, 1, 2, 3].map((index) => (
                <View
                  key={index}
                  style={[styles.progressDot, index === currentSlide && styles.progressDotActive]}
                />
              ))}
            </View>

            {/* Navigation and Controls */}
            <View style={styles.tutorialControls}>
              {/* Left Arrow */}
              <TouchableOpacity
                style={[styles.arrowButton, currentSlide === 0 && styles.arrowButtonDisabled]}
                onPress={() => currentSlide > 0 && setCurrentSlide(currentSlide - 1)}
                disabled={currentSlide === 0}
              >
                <ChevronLeft size={24} color={currentSlide === 0 ? Colors.textMuted : Colors.gold} />
              </TouchableOpacity>

              {/* Checkbox */}
              <TouchableOpacity
                style={styles.checkboxCompact}
                onPress={() => setDontShowTutorialAgain(!dontShowTutorialAgain)}
              >
                <View style={[styles.checkboxSmall, dontShowTutorialAgain && styles.checkboxSmallChecked]}>
                  {dontShowTutorialAgain && <Text style={styles.checkboxSmallTick}>✓</Text>}
                </View>
                <Text style={styles.checkboxSmallLabel}>Ne plus afficher</Text>
              </TouchableOpacity>

              {/* Right Arrow */}
              <TouchableOpacity
                style={[styles.arrowButton, currentSlide === 3 && styles.arrowButtonDisabled]}
                onPress={() => currentSlide < 3 && setCurrentSlide(currentSlide + 1)}
                disabled={currentSlide === 3}
              >
                <ChevronRight size={24} color={currentSlide === 3 ? Colors.textMuted : Colors.gold} />
              </TouchableOpacity>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.tutorialButtonsBottom}>
              <TouchableOpacity
                style={styles.tutorialCancelBtn}
                onPress={() => {
                  setShowScanTutorial(false);
                  setCurrentSlide(0);
                }}
              >
                <Text style={styles.tutorialCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tutorialStartBtn}
                onPress={async () => {
                  if (dontShowTutorialAgain) {
                    try {
                      await AsyncStorage.setItem('scan_tutorial_hidden', 'true');
                    } catch (e) {
                      console.log('[Browse] Error saving tutorial preference:', e);
                    }
                  }
                  setShowScanTutorial(false);
                  setCurrentSlide(0);
                }}
              >
                <Text style={styles.tutorialStartText}>Démarrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#0A0A0A',
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  urlText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  scanStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  scanStartText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  scanStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.recording,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  scanStopText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  scanIndicatorBar: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 59, 48, 0.25)',
  },
  scanIndicatorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  scanIndicatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.recording,
  },
  scanIndicatorText: {
    color: Colors.recording,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  scanMeta: {
    flex: 1,
    gap: 6,
    alignItems: 'flex-end',
  },
  tipText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'right',
  },
  progressMini: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressMiniFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  webviewInner: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  scanOverlayEdge: {
    ...StyleSheet.absoluteFillObject,
  },
  scanEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.recording,
    opacity: 0.7,
  },
  scanEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.recording,
    opacity: 0.7,
  },
  scanEdgeLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.recording,
    opacity: 0.7,
  },
  scanEdgeRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.recording,
    opacity: 0.7,
  },
  recBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  recBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  recBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  resultsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultsCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  analyzingContainer: {
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  analyzingEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  analyzingText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
    marginBottom: 12,
  },
  analyzingSubtext: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  analysisProgressBar: {
    width: '100%',
    height: 5,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  analysisProgressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  analysisSteps: {
    alignSelf: 'stretch',
    gap: 14,
  },
  analysisStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
  },
  stepDotActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  stepDotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
    opacity: 0.4,
  },
  stepLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  stepLabelDone: {
    color: Colors.success,
  },
  stepLabelActive: {
    color: Colors.gold,
    fontWeight: '600' as const,
  },
  resultContent: {
    padding: 28,
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginBottom: 6,
  },
  resultProfit: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 20,
  },
  resultSubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  resultsList: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultRowTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
    marginRight: 10,
  },
  resultRowProfit: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  moreText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  resultActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
    alignSelf: 'stretch',
  },
  resultActionText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  continueBtn: {
    marginTop: 12,
    paddingVertical: 12,
  },
  continueBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  // Tutorial Modal Carousel Styles
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  tutorialModal: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    width: '100%',
    maxHeight: '92%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  tutorialHeader: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tutorialTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  tutorialSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  carouselContainer: {
    height: 210,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  slide: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  slideIcon: {
    fontSize: 36,
  },
  slideTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  slideText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.cardBorder,
  },
  progressDotActive: {
    backgroundColor: Colors.gold,
    width: 24,
  },
  tutorialControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  arrowButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  checkboxCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginHorizontal: 8,
  },
  checkboxSmall: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSmallChecked: {
    backgroundColor: Colors.gold,
  },
  checkboxSmallTick: {
    color: Colors.surface,
    fontSize: 11,
    fontWeight: '700',
  },
  checkboxSmallLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tutorialButtonsBottom: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingHorizontal: 24,
  },
  tutorialCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tutorialCancelText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  tutorialStartBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
  },
  tutorialStartText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
});
