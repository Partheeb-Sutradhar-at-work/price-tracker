import json
import logging
import re
from dataclasses import dataclass

from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeoutError

logger = logging.getLogger(__name__)

CURRENCY_RE = re.compile(r"[\$£€¥]\s*[\d,]+(?:\.\d{1,2})?")


@dataclass
class ScrapeResult:
    price: float
    title: str
    image_url: str | None


class ScraperError(Exception):
    pass


async def _extract_amazon(page: Page) -> ScrapeResult | None:
    try:
        await page.wait_for_selector("#productTitle", timeout=8000)
        title_el = page.locator("#productTitle")
        title = (await title_el.text_content() or "").strip()

        # Price: whole + fraction, or the offscreen span
        price_str = None
        whole = page.locator(".a-price-whole").first
        frac = page.locator(".a-price-fraction").first
        if await whole.count() > 0:
            w = (await whole.text_content() or "").strip().rstrip(".")
            f = (await frac.text_content() or "00").strip() if await frac.count() > 0 else "00"
            price_str = f"{w}.{f}"
        else:
            # corePriceDisplay offscreen
            el = page.locator(".a-offscreen").first
            if await el.count() > 0:
                price_str = (await el.text_content() or "").strip()

        if not price_str:
            return None

        price = _parse_price(price_str)
        if price is None:
            return None

        image_url = await page.locator("#landingImage").first.get_attribute("src")
        return ScrapeResult(price=price, title=title, image_url=image_url)
    except PlaywrightTimeoutError:
        return None
    except Exception as exc:
        logger.warning("Amazon extraction failed: %s", exc)
        return None


async def _extract_bestbuy(page: Page) -> ScrapeResult | None:
    try:
        await page.wait_for_selector("h1", timeout=8000)
        title = (await page.locator("h1").first.text_content() or "").strip()

        price: float | None = None

        # Strategy 1: JSON-LD structured data
        ld_els = page.locator('script[type="application/ld+json"]')
        for i in range(await ld_els.count()):
            try:
                raw = await ld_els.nth(i).inner_text()
                data = json.loads(raw)
                offers = data.get("offers") or data.get("@graph", [{}])[0].get("offers")
                if isinstance(offers, list):
                    offers = offers[0]
                if isinstance(offers, dict) and "price" in offers:
                    price = float(offers["price"])
                    break
            except Exception:
                continue

        # Strategy 2: visible price span
        if price is None:
            sel = 'span[aria-hidden="true"][class*="text-7"]'
            el = page.locator(sel).first
            if await el.count() > 0:
                price = _parse_price((await el.text_content() or "").strip())

        # Strategy 3: sr-only price span
        if price is None:
            sr_spans = page.locator("span.sr-only")
            for i in range(await sr_spans.count()):
                txt = (await sr_spans.nth(i).text_content() or "").strip()
                if CURRENCY_RE.match(txt):
                    price = _parse_price(txt)
                    break

        if price is None:
            return None

        image_url = await page.locator('img[data-nimg="1"]').first.get_attribute("src")
        if image_url and ";" in image_url:
            image_url = image_url.split(";")[0]

        return ScrapeResult(price=price, title=title, image_url=image_url)
    except PlaywrightTimeoutError:
        return None
    except Exception as exc:
        logger.warning("Best Buy extraction failed: %s", exc)
        return None


async def _extract_og_meta(page: Page) -> ScrapeResult | None:
    try:
        price_str = await page.evaluate("""
            () => {
                const metas = ['og:price:amount', 'product:price:amount'];
                for (const name of metas) {
                    const el = document.querySelector(`meta[property="${name}"]`);
                    if (el) return el.getAttribute('content');
                }
                return null;
            }
        """)
        if not price_str:
            return None
        price = _parse_price(price_str)
        if price is None:
            return None

        title = await page.evaluate("() => document.title") or ""
        image_url = await page.evaluate("""
            () => {
                const el = document.querySelector('meta[property="og:image"]');
                return el ? el.getAttribute('content') : null;
            }
        """)
        return ScrapeResult(price=price, title=title.strip(), image_url=image_url)
    except Exception as exc:
        logger.warning("og:meta extraction failed: %s", exc)
        return None


async def _extract_regex_fallback(page: Page) -> ScrapeResult | None:
    try:
        body_text = await page.evaluate("() => document.body.innerText")
        matches = CURRENCY_RE.findall(body_text or "")
        if not matches:
            return None
        price = _parse_price(matches[0])
        if price is None:
            return None
        title = (await page.evaluate("() => document.title") or "").strip()
        image_url = await page.evaluate("""
            () => {
                const el = document.querySelector('meta[property="og:image"]');
                return el ? el.getAttribute('content') : null;
            }
        """)
        return ScrapeResult(price=price, title=title, image_url=image_url)
    except Exception as exc:
        logger.warning("Regex fallback failed: %s", exc)
        return None


def _parse_price(raw: str) -> float | None:
    cleaned = re.sub(r"[^\d.]", "", raw)
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


async def scrape_product(url: str) -> ScrapeResult:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="load", timeout=30000)
            await page.wait_for_timeout(2000)
        except PlaywrightTimeoutError as exc:
            await browser.close()
            raise ScraperError(f"Page load timed out for {url}") from exc

        result: ScrapeResult | None = None

        lower = url.lower()
        if "amazon." in lower:
            result = await _extract_amazon(page)
        elif "bestbuy.com" in lower:
            result = await _extract_bestbuy(page)

        if result is None:
            result = await _extract_og_meta(page)

        if result is None:
            result = await _extract_regex_fallback(page)

        await browser.close()

        if result is None:
            raise ScraperError(f"Could not extract price from {url}")

        return result
