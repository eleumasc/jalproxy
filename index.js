const mockttp = require('mockttp');

(async () => {
    const server = mockttp.getLocal({
        https: {
            keyPath: 'certs/mockttp-ca.key',
            certPath: 'certs/mockttp-ca.pem'
        }
    });

    const httpMemory = new Map();

    server.anyRequest().thenPassThrough({
        "beforeRequest": async req => {
            httpMemory.set(req.id, { "sec-fetch-dest": req.headers["sec-fetch-dest"] });
        },
        "beforeResponse": async res => {
            const secFetchDest = httpMemory.get(res.id)["sec-fetch-dest"];
            httpMemory.delete(res.id);
            const mimeType = (res.headers["content-type"] || "").split(";")[0];
            const isDocument = (secFetchDest === "document" && mimeType === "text/html");
            const isScript = (secFetchDest === "script" && (mimeType === "text/javascript" || mimeType === "application/javascript"));
            if (isDocument || isScript) {
                const body = await instrument(await res.body.getText(), isDocument);
                return {
                    headers: {
                        ...res.headers,
                        'content-length': undefined,
                        'content-encoding': undefined
                    },
                    body: body
                };
            } else {
                return {};
            }
        }
    });

    await server.start();

    console.log(`Server running on port ${server.port}`);
})();

async function instrument(originalBody, isDocument) {
    if (isDocument) {
        return originalBody + "\n<script>document.body.innerHTML = 'Hello HTML!' + document.body.innerHTML;</script>";
    } else {
        return "// hello JS!\n" + originalBody;
    }
}
