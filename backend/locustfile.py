"""
Load test for the Darra public API — the endpoints a launch crowd hits while
browsing (all anonymous, no login): product list, filtering, search, product
detail, and the stores list.

Run against a LOCAL or STAGING server, never the small production box:

    locust -f backend/locustfile.py --host http://localhost:8000

Then open http://localhost:8089 and set users/spawn rate. Or headless:

    locust -f backend/locustfile.py --host http://localhost:8000 \
           --headless -u 50 -r 10 -t 1m

NOTE: the public endpoints are anonymous, and behind the Next.js proxy Django
sees them all as one IP, so the AnonRateThrottle (100/hour) applies globally.
Expect a wall of 429s early — that is a finding about throttle config, not
about capacity. Raise DEFAULT_THROTTLE_RATES['anon'] (or exempt these read
endpoints) to measure raw performance.
"""

import random

from locust import HttpUser, task, between


class MarketplaceBrowser(HttpUser):
    # Real people pause between clicks; this keeps the load realistic rather
    # than a raw hammer.
    wait_time = between(1, 4)

    # Shared across users so product-detail hits real IDs.
    product_ids = []

    def on_start(self):
        r = self.client.get(
            "/api/products/?page=1&page_size=24",
            name="/api/products [list]",
        )
        if r.status_code == 200:
            try:
                data = r.json()
                results = data.get("results") if isinstance(data, dict) else data
                MarketplaceBrowser.product_ids = [p["id"] for p in (results or [])][:20]
            except Exception:
                pass

    @task(6)
    def browse_pages(self):
        page = random.randint(1, 3)
        order = random.choice(["newest", "price_asc", "price_desc"])
        self.client.get(
            f"/api/products/?page={page}&page_size=24&ordering={order}",
            name="/api/products [browse]",
        )

    @task(3)
    def filter_by_type(self):
        product_type = random.choice(["pdf", "docx", "mp3", "event"])
        self.client.get(
            f"/api/products/?product_type={product_type}&page_size=24",
            name="/api/products [category]",
        )

    @task(3)
    def search(self):
        q = random.choice(["book", "music", "guide", "art", "course"])
        self.client.get(
            f"/api/products/?search={q}&page_size=24",
            name="/api/products [search]",
        )

    @task(4)
    def product_detail(self):
        if self.product_ids:
            pid = random.choice(self.product_ids)
            self.client.get(f"/api/products/{pid}/", name="/api/products/[id]")

    @task(2)
    def browse_stores(self):
        self.client.get(
            "/api/auth/stores/?page_size=24",
            name="/api/auth/stores [list]",
        )
