# Clickbait filtering research and verification

The September 2026 rules update focuses on titles that omit the useful detail or promise an exaggerated reaction. It improves the local rules; it does not introduce a model, a network classifier, or article-level fact checking.

## Sources and implementation choices

These primary sources informed the changes:

- [Meta: New Updates to Reduce Clickbait Headlines (2017)](https://about.fb.com/news/2017/05/news-feed-fyi-new-updates-to-reduce-clickbait-headlines/) distinguishes withholding information from exaggeration and gives example headlines. This informed separate hooks for concealed details and promised reactions.
- [Potthast et al.: The Clickbait Challenge 2017 (2018)](https://arxiv.org/abs/1812.10847) discusses exaggerated promises and omitted details. The [Webis-Clickbait-17 corpus](https://webis.de/data/webis-clickbait-17.html) uses graded human judgments, which supports retaining sensitivity levels rather than treating every stylistic feature as conclusive.
- [Scott: You won't believe what's in this paper! Clickbait, relevance and the curiosity gap (2021)](https://www.sciencedirect.com/science/article/pii/S0378216621000229) studies definite referring expressions, superlatives, and intensifiers. This informed attention to vague referents, but those words alone do not trigger filtering.
- [Molina et al.: Does Clickbait Actually Attract More Clicks? (2021)](https://pike.psu.edu/publications/chi21.pdf) examines several headline features, including questions and lists. Bleeo requires a specific teaser or other evidence; questions and numbered guides remain ordinary candidates.

The weights and regular expressions are Bleeo implementation choices, not parameters supplied or validated by these studies.

| Signal | Original example | Behavior |
| --- | --- | --- |
| Disbelief | You’ll never guess why this tiny café has a queue | Filter at medium |
| Exaggerated payoff | This ordinary cupboard makeover will blow your mind | Filter at medium |
| Withheld detail | A courier rang the bell and then this happened | Filter at medium |
| List teaser | Seven packing ideas: number 4 will shock you | Filter at medium |
| Specific explanation | This is why officials issued an urgent flood warning | Keep visible |
| Numbered guide | 10 ways to organize your notes for the next exam | Keep visible |

Specific hooks contribute 0.72 once, even if several hook expressions overlap. The existing low/medium/high thresholds remain 0.84/0.68/0.56. A single plain hook is enough at medium, while low generally requires another signal. Existing social uppercase rules still apply separately.

Matching normalizes curly apostrophes, compatibility characters such as full-width letters, dash variants, and invisible formatting characters without altering displayed text. Short text is admitted only when it contains a specific hook; navigation labels remain excluded. Headings and title links can be collected across child elements. Social cards that exceed the aggregate limits fall back to individual headline/text scanning instead of excluding all their children.

## Reproducible regression evaluation

`tests/fixtures/headlines.json` contains 25 clickbait examples and 25 ordinary headlines. All are authored examples except the explicitly attributed Meta headline. They were selected to exercise these rules and their false-positive boundaries. They are **not an independent dataset**, and passing them does not establish real-world precision or recall. Webis data was researched but was not used for training or a benchmark run.

Run the classification and candidate-eligibility comparison:

```bash
npm run evaluate
npm run evaluate -- --baseline e655b01
npm test
```

On this 50-example set, using the news hostname `bbc.com`:

| Medium sensitivity | Clickbait detected | Ordinary headlines filtered |
| --- | --- | --- |
| Previous rules (`e655b01`) | 0 / 25 | 2 / 25 |
| Updated rules | 25 / 25 | 0 / 25 |

The old rules already detected louder alarmist combinations in the existing tests. This set specifically exposes missed plain hooks. At high, the updated detector also keeps all 25 ordinary examples visible; at low it detects 4 of the 25 clickbait examples, consistent with requiring stronger evidence.

The script reports counts, precision, recall, and medium-sensitivity errors for the authored set. A historical baseline loads that revision's heuristics with the current shared settings; this comparison uses unchanged news-host behavior. Existing tests cover social uppercase behavior, sensitivity differences, overlapping hooks, Unicode, and scan limits.

Next, evaluate an independently sampled, human-labeled set of current headlines and social posts. Subtle misleading headlines may require article context; the current text rules cannot establish whether a claim is exaggerated or true.
