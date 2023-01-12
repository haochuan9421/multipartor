const fs = require("fs");
const path = require("path");
const stream = require("stream");

const busboy = require("busboy");
const formidable = require("formidable");
const multipartor = require("../index");

function buildMultipart(boundary) {
  return new Promise((done) => {
    const ws = fs.createWriteStream(`${boundary}`);

    let i = 30;
    let j = 30;
    let isOk = true;
    const tick = () => {
      if (!isOk) {
        return;
      }

      if (i > 0) {
        isOk = ws.write(
          Buffer.from(
            [
              `--${boundary}`,
              `content-disposition: form-data; name="field_${i}"`,
              "",
              "0".repeat(65536), // 64K
              "",
            ].join("\r\n")
          )
        );
        i--;
        tick();
      } else if (j > 0) {
        isOk = ws.write(
          Buffer.from(
            [
              `--${boundary}`,
              `content-disposition: form-data; name="file_${j}"; filename="file_${j}.txt"`,
              "content-type: text/plain",
              "",
              "0".repeat(67108864), // 64M
              "",
            ].join("\r\n")
          )
        );
        j--;
        tick();
      } else {
        ws.end(Buffer.from(`--${boundary}--\r\n`));
        done();
      }
    };
    ws.on("drain", () => {
      isOk = true;
      tick();
    });
    tick();
  });
}

function runBusboy(req, uploadDir) {
  return new Promise((done) => {
    const parser = busboy({ headers: req.headers });
    parser.on("file", (name, file, meta) => {
      const filename = "busboy-" + `${Math.random()}`.slice(2) + path.extname(meta.filename);
      const filePath = path.join(uploadDir, filename);
      stream.pipeline(file, fs.createWriteStream(filePath), () => {});
    });
    parser.on("close", () => {
      done();
    });
    req.pipe(parser);
  });
}

function runFormidable(req, uploadDir) {
  return new Promise((done) => {
    const form = formidable({
      multiples: true,
      maxFileSize: Infinity,
      uploadDir,
      filename(filename, ext) {
        return "formidable-" + `${Math.random()}`.slice(2) + ext;
      },
    });
    form.parse(req, (err, fields, files) => {
      done();
    });
  });
}

function runMultipartor(req, uploadDir) {
  return new Promise((done) => {
    multipartor(req, {
      onFile(file, meta, cb) {
        const filename = "multipartor-" + `${Math.random()}`.slice(2) + path.extname(meta.filename);
        const filePath = path.join(uploadDir, filename);
        stream.pipeline(file, fs.createWriteStream(filePath), cb);
      },
    }).finally(done);
  });
}

function randomString(len) {
  let charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let str = "";
  for (let i = 0; i < len; i++) {
    str += charset[Math.floor(Math.random() * charset.length)];
  }
  return str;
}

function measure(name) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  return () => {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    console.log(
      name,
      `${endTime - startTime}ms`,
      Object.keys(endMemory).reduce((res, key) => {
        res[key] = `${((endMemory[key] - startMemory[key]) / 1048576).toFixed(2)}MB`; // Byte to MB
        return res;
      }, {})
    );
  };
}

(async () => {
  const boundary = `----WebKitFormBoundary${randomString(16)}`;
  await buildMultipart(boundary);
  const totalSize = fs.statSync(boundary).size;
  const headers = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": totalSize,
  };
  const uploadDir = "upload";
  if (!fs.existsSync(uploadDir) || !fs.statSync(uploadDir).isDirectory()) {
    fs.mkdirSync(uploadDir);
  }

  console.log(`Content-Length: ${(totalSize / 2 ** 30).toFixed(2)}GB`);

  {
    await new Promise((r) => setTimeout(r, 1000));
    const req = fs.createReadStream(boundary);
    req.headers = headers;
    const log = measure("busboy");
    await runBusboy(req, uploadDir);
    log();
  }

  {
    await new Promise((r) => setTimeout(r, 1000));
    const req = fs.createReadStream(boundary);
    req.headers = headers;
    const log = measure("formidable");
    await runFormidable(req, uploadDir);
    log();
  }

  {
    await new Promise((r) => setTimeout(r, 1000));
    const req = fs.createReadStream(boundary);
    req.headers = headers;
    const log = measure("multipartor");
    await runMultipartor(req, uploadDir);
    log();
  }

  fs.rmSync(uploadDir, { recursive: true });
  fs.rmSync(boundary);
})();
