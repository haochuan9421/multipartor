const fs = require("fs");
const stream = require("stream");

const busboy = require("busboy");
const formidable = require("formidable");
const multipartor = require("../index");

function buildMultipart(boundary) {
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
    }
  };
  ws.on("drain", () => {
    isOk = true;
    tick();
  });
  tick();
}

function runBusboy(req, boundary) {
  return new Promise((done) => {
    const parser = busboy({ headers: { "content-type": `multipart/form-data; boundary=${boundary}` } });
    parser.on("file", (name, file, info) => {
      file.on("data", () => {});
    });
    parser.on("close", () => {
      done();
    });
    req.pipe(parser);
  });
}

function runFormidable(req, boundary) {
  return new Promise((done) => {
    const parser = new formidable.MultipartParser();
    parser.initWithBoundary(boundary);
    parser.on("data", ({ name }) => {
      if (name === "end") {
        done();
      }
    });
    req.pipe(parser);
  });
}

function runMultipartor(req, boundary) {
  return multipartor(req, {
    boundary,
    onFile(file, meta, cb) {
      file.on("data", () => {}).on("end", () => cb(null));
    },
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
        res[key] = (endMemory[key] - startMemory[key]) / 1048576; // Byte to MB
        return res;
      }, {})
    );
  };
}

async function benchmark() {
  const boundary = `----WebKitFormBoundary${randomString(16)}`;
  buildMultipart(boundary);

  {
    await new Promise((r) => setTimeout(r, 3000));
    const log = measure("busboy");
    await runBusboy(fs.createReadStream(boundary), boundary);
    log();
  }

  {
    await new Promise((r) => setTimeout(r, 3000));
    const log = measure("formidable");
    await runFormidable(fs.createReadStream(boundary), boundary);
    log();
  }

  {
    await new Promise((r) => setTimeout(r, 3000));
    const log = measure("multipartor");
    await runMultipartor(fs.createReadStream(boundary), boundary);
    log();
  }

  fs.rmSync(boundary);
}

benchmark();
