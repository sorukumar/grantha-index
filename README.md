# Grantha Index

This repository is the product UI for Grantha Index.

## Source of Truth
The source of truth for all data is `grantha-corpus` (specifically `catalog/works.yaml`).
Do not store raw scripture text here.

We use a hybrid runtime-fetch architecture to connect the data:
1. **Local Development**: The `data` folder is a symlink to `../grantha-corpus/catalog`. Local scripts fetch from `data/works.yaml`.
2. **Production (GitHub Pages)**: The frontend checks the environment. If remote, it fetches `works.yaml` directly from the raw GitHub URL (`https://raw.githubusercontent.com/[USER]/grantha-corpus/main/catalog/works.yaml`).

## Future Views (v1)
- Table
- Timeline
- Family tree
- Per-work page

## Sister Project
The sister repository `grantha-corpus` holds the source of truth data.
