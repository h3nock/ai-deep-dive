## Dataset 

This section is meant to be a slow, detailed walk through the data side of the project. The goal is that, by the end, a learner not only knows what the dataset is and how it is stored, but also feels comfortable downloading shards, opening Parquet files, and inspecting row groups in a very hands‑on way.

### Data Overview

The core dataset used in nanochat is **FineWeb‑Edu‑100B**, which is derived from the much larger FineWeb and FineWeb‑Edu datasets. FineWeb‑Edu applies a classifier to the raw web crawled FineWeb to keep only the most educational webpages, and FineWeb‑Edu‑100B then selects a subset that is manageable for training.

- **Lineage and scale**  
  FineWeb‑Edu as a whole contains roughly **3.5 billion rows** and around **10.4 TB** of data. From that, FineWeb‑Edu‑100B keeps about **98 million rows**, which in our setup comes to roughly **170 GB** of content. 

- **What a row looks like**  
  Conceptually, each row represents a single webpage that has been crawled and processed. A row typically contains the **main text content** that the model will learn from. For example, one of the rows corresponds to this page:  
  <https://theintactone.com/2019/08/01/eid-u3-topic-7-shipment-transport-sea-air-rail-road-pipeline/>  
  When you open that page, you see long‑form explanatory text about transportation modes. Our dataset stores that kind of content as plain text, row by row.

- **Sharding the dataset**  
  Because 170 GB is far too large to treat as a single file, the dataset is split into **1,822 Parquet shards**, each roughly **90 MB** on disk and containing on the order of **~53 k webpages (rows)**. This sharding makes the dataset practical to download, cache, and iterate over. In nanochat, we follow a simple convention: **all shards except the last one** are used for training, and **the final shard** is kept aside as the validation set.

### Parquet Primer

To store these billions of tokens efficiently, we use the **Parquet** file format via **PyArrow**. This section gives you an intuitive understanding of what Parquet is doing under the hood so the code in `nanochat/dataset.py` feels natural.

- **Columnar, compressed storage**  
  Parquet is a **columnar** format, which means it stores each column (for example, `text` or `url`) together rather than storing entire rows contiguously. This design is ideal for analytics and machine‑learning workloads where you often read only a subset of columns. Parquet also applies compression and encoding on a per‑column basis, which is why we can store so many webpages in a ~90 MB file while still reading them quickly.

- **Row groups as the unit of access**  
  Inside a Parquet file, data is organized into **row groups**. Each row group is a chunk of rows (for example, several thousand webpages) that can be read independently of the others. When we construct a `pq.ParquetFile` object in PyArrow, the library first reads **only the metadata**: the schema, the number of row groups, and statistics about each group. Importantly, **no actual text data is loaded yet**.

  When we later call `pf.read_row_group(rg_idx)`, PyArrow uses this metadata to seek directly to the corresponding row group on disk and read just that portion into memory. This is the key to efficient streaming: we can iterate over the dataset in row‑group batches without ever loading the entire shard at once.

- **File anatomy at a high level**  
  A Parquet file consists of:

  - A **schema**, describing the columns and their types.
  - One or more **row groups**, each containing column chunks for all columns.
  - A **footer**, which stores metadata and indexes for fast random access.

  For nanochat, the most important columns are the textual ones (e.g., `text`). Our code leans heavily on the fact that we can ask for just the `text` column from a row group, turn it into a Python list, and then feed those strings into the tokenizer.

- **Mini exercises to build intuition**
  1. **List shards** – write or run a helper (e.g., `python -m nanochat.dataset list-parquet`) that prints all shard paths and their sizes. Verify that you see 1,822 files, each around 90 MB.
  2. **Inspect a shard** – in a Python shell or notebook, open one shard with `pq.ParquetFile`, print its `schema`, print `num_row_groups`, and read the first few rows of the `text` column. This makes the abstract talk about “row groups” very concrete.
  3. **Follow `parquets_iter_batched`** – using `parquets_iter_batched(split="train", start=0, step=1)`, print out the row‑group index each time you yield a batch. Then, change `start` and `step` to simulate distributed training (for example, `start=1, step=2`) and observe how the workload is split.

### Step‑by‑Step Challenges

The following challenges are deliberately ordered so that each one builds on the last. If you follow them in sequence, you will gradually move from basic data access to confident manipulation of Parquet shards and row groups.

1. **Download data given a single URL**  
   Start with the most fundamental operation: given a direct download URL for a shard, write a small script or function that downloads that file to disk. Focus on correctness and clarity first: construct the HTTP request, stream the response to a local file (so you do not keep everything in memory), and verify that the file exists and has a reasonable size when you are done.

2. **Add retries to make downloads robust**  
   Once you can download a single file, harden your code so it behaves well in the real world. Network connections drop, servers occasionally respond with 5xx errors, and timeouts happen. Extend your downloader to **retry** failed downloads a few times with a simple backoff strategy. Log each attempt so you can see what is happening, and consider adding a checksum (if available) so that you can detect incomplete or corrupted downloads and try again.

3. **Download a list of files given a folder or manifest**  
   With a robust single‑file downloader in hand, the next step is to scale out. Imagine you have a folder or manifest that lists all 1,822 shard URLs. Write code that iterates over this list and downloads each shard one by one (optionally in parallel, once the sequential version works). Keep track of your progress in a small index file or JSON so that if the process is interrupted, you can resume without starting from scratch. This is the point where you really feel how a huge dataset becomes manageable through sharding.

4. **Open a Parquet file**  
   After you have some shards on disk, move to inspection. Use PyArrow’s `pq.ParquetFile` API to open a single shard, print out its schema, and inspect how many row groups it contains. Confirm that the columns match your expectations (for example, that there is a `text` column). This step connects the abstract idea of “Parquet shard” to a concrete file on your machine.

5. **Print the content of a Parquet file**  
   Finally, practice reading actual data from the shard. Use `read_row_group` to load the first row group, extract the `text` column, convert it to a Python list, and print the first few entries. Try doing the same for different row groups, or for a different shard. As you do this, pay attention to how quickly data loads and how little memory you use compared to reading the entire file at once. This will reinforce why the row‑group‑based iteration in `parquets_iter_batched` is such a powerful design choice.

As you go through these steps, keep notes on anything that feels surprising or non‑obvious. Those are exactly the spots where future readers will benefit most from diagrams, screenshots, or additional commentary. Over time, this document can evolve into a comprehensive, narrative guide to the data pipeline that learners can follow almost like a story, from raw web pages all the way to tokenized batches entering the model.
