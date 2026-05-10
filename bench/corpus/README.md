# bench/corpus/

PDFs are user data — never commit. This directory is the **local cache** for
the parse-quality benchmark; it mirrors the layout of the production GCS
bucket so the harness can run offline against a developer's copy.

Layout:

```
bench/corpus/
  home/<id>.pdf
  auto/<id>.pdf
  travel/<id>.pdf
  mobile-warranty/<id>.pdf
  whitegoods-warranty/<id>.pdf
  creditcard/<id>.pdf
  employer-benefits/<id>.pdf
```

To populate this directory locally:

```
gcloud storage rsync -r gs://${BENCH_GCS_BUCKET}/ bench/corpus/
```

Anonymisation is **mandatory** before a doc enters the corpus. Run
`tsx bench/anonymise.ts <pdf>` and resolve every flagged finding before
adding the doc to `bench/manifest.json`.
