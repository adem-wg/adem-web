- This repository contains a single-page application for verifying ADEM using the DNS.
- The page layout should be simple.
It should contain a single search-like bar in which one can enter domain names.
Upon pressing enter or clicking the appropriate button, the app should attempt to fetch tokens via the DNS, and verify them accordingly.
Results of the verification, with all relevant details (marked asset, issuer, number of endorsements, precise verification result, etc.) should be presented below.
- The page should use the code at https://github.com/adem-wg/adem-js for verification.
  - You have control over the `adem-js` implementation.
  You may adjust it when necessary, and whenever the adjustments are a general improvement to the library that could also benefit other use cases.
