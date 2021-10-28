(async () => {

    const process = require("process");

    require("dotenv").config();
    if (!process.env.JALANGI_HOME) {
        throw new Error("JALANGI_HOME is not defined in environment.");
    }

    const mockttp = require("mockttp");

    const child_process = require("child_process");
    const fs = require("fs");
    const fsPromises = fs.promises;
    const os = require("os");
    const path = require("path");
    const url = require("url");

    const JALANGI_HOME = path.normalize(process.env.JALANGI_HOME);
    console.log(`JALANGI_HOME="${JALANGI_HOME}"`);

    const ESNSTRUMENT_PATH = path.join(JALANGI_HOME, "src/js/commands/esnstrument_cli.js");

    const JALANGI_ARGS = [
        "--inlineIID",
        "--inlineSource",
        "--analysis", path.join(JALANGI_HOME, "src/js/sample_analyses/ChainedAnalyses.js"),
        "--analysis", path.join(JALANGI_HOME, "src/js/runtime/analysisCallbackTemplate.js")
    ];

    const HTML_MIME_TYPES = ["text/html"];

    const JS_MIME_TYPES = [
        "text/javascript",
        "application/javascript",
        "application/x-javascript"
    ];

    const server = mockttp.getLocal({
        https: {
            keyPath: path.normalize("certs/mockttp-ca.key"),
            certPath: path.normalize("certs/mockttp-ca.pem")
        }
    });

    const httpRequestInfo = new Map();

    server.anyRequest().thenPassThrough({
        "beforeRequest": async req => {
            const reqURL = new url.URL(req.url);
            httpRequestInfo.set(req.id, {
                id: req.id,
                url: reqURL.origin + reqURL.pathname,
                secFetchDest: req.headers["sec-fetch-dest"]
            });
        },
        "beforeResponse": async res => {
            const info = httpRequestInfo.get(res.id);
            httpRequestInfo.delete(res.id);
            const secFetchDest = info.secFetchDest;
            const mimeType = (res.headers["content-type"] || "").split(";")[0];
            const isDocument =
                secFetchDest === "document" &&
                HTML_MIME_TYPES.includes(mimeType);
            const isScript =
                !isDocument &&
                secFetchDest === "script" &&
                JS_MIME_TYPES.includes(mimeType);
            if (isDocument || isScript) {
                const body = await instrument(await res.body.getText(), info);
                return {
                    headers: {
                        ...res.headers,
                        "content-type": mimeType + "; charset=UTF-8",
                        "content-length": undefined,
                        "content-encoding": undefined,
                        "content-security-policy": undefined
                    },
                    body: body
                };
            } else {
                return {};
            }
        }
    });

    const STORAGE_PATH = await fsPromises.mkdtemp(path.join(os.tmpdir(), "jalproxy-"));

    await server.start();
    console.log(`Server running on port ${server.port}`);

    async function instrument(origBody, info) {
        const outDir = path.join(STORAGE_PATH, info.id);
        await fsPromises.mkdir(outDir);
        try {
            const dotext = info.secFetchDest === "document" ? ".html" : ".js";
            const origFileName = "orig" + dotext;
            await fsPromises.writeFile(path.join(outDir, origFileName), origBody);
            const instFileName = "inst" + dotext;
            await enstruments(origFileName, instFileName, outDir, info.url);
            const instBody = await fsPromises.readFile(path.join(outDir, instFileName));
            return instBody;
        } finally {
            await fsPromises.rm(outDir, { recursive: true, force: true });
        }
    }

    async function enstruments(origFileName, instFileName, outDir, url) {
        const subProcess = child_process.spawn("node", [
            ESNSTRUMENT_PATH, ...JALANGI_ARGS,
            path.join(outDir, origFileName),
            "--out", path.join(outDir, instFileName),
            "--outDir", outDir,
        ], {
            env: { ...process.env, "JALANGI_URL": url },
            stdio: "inherit"
        });

        return new Promise((resolve, reject) => {
            subProcess.on('exit', function (code, signal) {
                resolve({ code: code, signal: signal });
            });

            subProcess.on('error', function (err) {
                reject(err);
            });
        })
    }

})();
