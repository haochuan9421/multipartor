# multipartor

multipartor parsing `multipart/form-data` requests for Node.js, which are commonly used for file uploads.

<p align="center">
    <a href="https://www.npmjs.com/package/multipartor" target="_blank"><img src="https://img.shields.io/npm/v/multipartor.svg?style=flat-square" alt="Version"></a>
    <a href="https://npmcharts.com/compare/multipartor?minimal=true" target="_blank"><img src="https://img.shields.io/npm/dm/multipartor.svg?style=flat-square" alt="Downloads"></a>
    <a href="https://github.com/haochuan9421/multipartor" target="_blank"><img src="https://visitor-badge.glitch.me/badge?page_id=haochuan9421.multipartor"></a>
    <a href="https://github.com/haochuan9421/multipartor/commits/master" target="_blank"><img src="https://img.shields.io/github/last-commit/haochuan9421/multipartor.svg?style=flat-square" alt="Commit"></a>
    <a href="https://github.com/haochuan9421/multipartor/issues" target="_blank"><img src="https://img.shields.io/github/issues-closed/haochuan9421/multipartor.svg?style=flat-square" alt="Issues"></a>
    <a href="https://github.com/haochuan9421/multipartor/blob/master/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@haochuan9421/multipartor.svg?style=flat-square" alt="License"></a>
</p>

[简体中文](https://github.com/haochuan9421/multipartor/blob/master/README.md)&emsp;
[English](https://github.com/haochuan9421/multipartor/blob/master/README_EN.md)&emsp;

## Features

- Fast, about 30% faster than [busboy](https://www.npmjs.com/package/busboy) and [formidable](https://www.npmjs.com/package/formidable)
- Lightweight, only about 300 lines of code
- Easy-to-use API
- Typescript Friendly

## Installation

```bash
npm i multipartor
```

## Quick Start

```js
const fs = require("fs");
const http = require("http");
const path = require("path");
const { pipeline } = require("stream");

const multipartor = require("multipartor");

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.headers["content-type"].startsWith("multipart/form-data")) {
      multipartor(req, {
        // "onFile" will be called when a file part is encountered
        onFile(file, meta, cb) {
          // The following code saves the uploaded file to the "upload" folder (assuming the "upload" folder already exists)
          const filePath = path.join("upload", `${Math.random()}`.slice(2) + path.extname(meta.filename));
          pipeline(file, fs.createWriteStream(filePath), (err) => {
            if (err) {
              cb(err);
            } else {
              cb(null, filePath);
            }
          });
        },
      })
        .then((result) => {
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(result, null, 2));
        })
        .catch((err) => {
          console.log("multipartor parse error", err);
        });
    } else {
      // Returns a form html for submit a multipart/form-data request
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(`<form action="/submit" method="post" enctype="multipart/form-data">
    <input name="username" type="text" />
    <select name="interest" multiple>
      <option value="coding">coding</option>
      <option value="music">music</option>
      <option value="game">game</option>
      <option value="dance">dance</option>
    </select>
    <input name="avatar" type="file" accept="image/*" />
    <input name="doc" type="file" multiple />
    <button type="submit">submit</button>
  </form>
  `);
    }
  })
  .listen(9000, () => {
    console.log("open http://127.0.0.1:9000");
  });
```

## Parameters of multipartor

`multipartor(rs, opts)`

- `rs`
  - type: [Readable](https://nodejs.org/api/stream.html#readable-streams)
  - description: [http.IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage), [readable stream](https://nodejs.org/api/stream.html#readable-streams) is also supported.
- `opts`
  - type:
    ```ts
    {
      // "boundary" can be specified, parse from rs.headers['content-type'] by default
      boundary?: string;
      // Whether to automatically call rs.destroy() and file.destroy() in case of errors in the request body parsing process, default is true
      autoDestroy?: boolean;
      // Various limit-related parameters, exceeding the limit will reject error and stop parsing
      limits?: {
        // Number of field part, up to 256 by default
        fields?: number;
        // The max size of a field part content, up to 65536 (bytes) by default (when reading the content of a field part, the data will temporarily exist in memory, so it needs to be limited, otherwise it may lead to memory leaks, the "text" type field of MySQL only occupies 65535 bytes, so there is no need to give too much space)
        fieldSize?: number;
        // Number of file part, up to 256 by default
        files?: number;
        // The max size of a file, no limited by default (when reading the contents of a file, it is done as a stream and the data is not temporarily stored in memory, so there is not much need to limit it)
        fileSize?: number;
        // Number of headers in a part, up to 3 by default, because each part usually has only Content-Disposition, Content-Type and Content-Transfer-Encoding headers
        partHeaders?: number;
        // The max size of a header, default 1024 (bytes) (when reading the header, the data is temporarily stored in memory, so it needs to be limited, otherwise it may lead to memory leaks)
        partHeaderSize?: number;
        // The total size of the request body, no limit by default
        totalSize?: number;
      };
      // "onField" function is called when a field part is encountered, if no "onField" function is provided, the content of the part will be converted to a utf-8 string
      // 1. "data" parameter is the content of the part, which can be custom transformed
      // 2. "meta" parameter is some basic information about the part, such as: "name" (the value of the name attribute in a form field), "encoding" (the value of the Content-Transfer-Encoding in the part header)
      // 3. "cb"   parameter is a callback function, if an error occurs during your custom transform process, the error message should be called back to notify "multipartor" to end the parsing of the whole request body, if no error occurs, the first parameter of the callback is "null", the second parameter is the result of the transform, the result will be put into the return value of the "multipartor" function
      // 4. Instead of using the "cb" parameter to call back the result, the "onField" function can also inform the result by returning a Promise
      onField?: (data: Buffer, meta: fieldMeta, cb: (err: null | Error, data?: any) => void) => void | Promise<any>;
      // "onFile" function is called when a file part is encountered, If the "onFile" function is not provided, the file content will be ignored
      // 1. "file" parameter is a readable stream which can be piped to your disk or other storage, this readable stream must be exhausted or the entire request parsing process may get stuck
      // 2. "meta" parameter is some basic information about the part, such as: "filename" (original filename), "mimeType" (mime type of the file)
      // 3. "cb"   parameter is a callback function, if an error occurs during your dump file process, the error message should be called back to notify "multipartor" to end the parsing of the whole request body, if no error occurs, the first parameter of the callback is "null", the second parameter is the result of the your dump, the result will be put into the return value of the "multipartor" function
      // 4. Instead of using the "cb" parameter to call back the result, the "onFile" function can also inform the result by returning a Promise
      onFile?: (file: Readable, meta: fileMeta, cb: (err: null | Error, data?: any) => void) => void | Promise<any>;
    }
    ```
  - description: Parsing configuration, refer to the comments above for details.

## Return value of multipartor

- type: `Promise<{ [key: string]: any[] }>`
- description: The result of parsing the entire request body. For example:
  ```json
  {
    "username": ["😊"],
    "interest": ["coding", "music", "game"],
    "avatar": ["upload/08948277734749754.png"],
    "doc": ["upload/8910049773055626.MP4", "upload/5344086262626364.pdf"]
  }
  ```
  Since a form field may have multiple values (e.g., a `select` field that can be multi-selected, a `checkbox` field, a `file` field that supports multiple file uploads, etc.), the results of a field are stored in an array, even if the field has only one value, a format that ensures that when any field is read, it is read in the same way.

## Benchmarks

The following figure shows the results of parsing the same request body with 30 field parts (64KB) and 30 file parts (64MB) using [busboy](https://www.npmjs.com/package/busboy), [formidable](https://www.npmjs.com/package/formidable) and [multipartor]( https://www.npmjs.com/package/multipartor). The `Content-Length` is the size of the request body, the number of milliseconds represents the time difference between the beginning and the end of parsing, and the memory-related data is the difference in the process memory usage between the beginning and the end of parsing. 4 plots correspond to 4 different data reading and writing scenarios.

1. `memory-read-no-write`: The data of the request body is already in memory and when a file part is encountered, the file is not written to disk.
2. `memory-read-disk-write`: The data of the request body is already in memory and when a file part is encountered, the file is written to disk.
3. `disk-read-no-write`: The data of the request body is read from disk and when a file part is encountered, the file is not written to disk.
4. `disk-read-disk-write`: The data of the request body is read from disk and when a file part is encountered, the file is written to disk.

<img alt="image" src="https://user-images.githubusercontent.com/5093611/212078779-330a79fa-2414-4714-a5ca-e60b585ffade.png">
<img alt="image" src="https://user-images.githubusercontent.com/5093611/212078816-d8a64cf1-e7d0-4b38-a32f-432cabb64619.png">

Test method 1, which measures the theoretical maximum parsing speed, shows that `multipartor` is theoretically about 4x faster than `busboy` and about 6x faster than `formidable`! But even the slowest `formidable` has a theoretical parsing speed of `3GB/s` (derived from `1.88GB/621ms`). Since the request body is usually read from the network and the parsed files are usually written to disk, the performance bottleneck in real-world scenarios is often not in the parsing speed, but in the disk write speed and the server's uplink bandwidth.

Test method 4 reading data from a local file (simulating the readable stream of a network request with a file readable stream) and writes the parsed file to local disk, which best reflects the performance gap between the three packages in real network IO.
