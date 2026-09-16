const SAMPLE_IMAGE_URL = "https://cdn.youverify.co/1655466566309-lLSfNTlhElMTtbXW-QE-q.jpg";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(SAMPLE_IMAGE_URL, { cache: "no-store" });
    if (!upstream.ok) {
      return Response.json({ error: "Unable to load Youverify sandbox image." }, { status: 502 });
    }

    const contentType = (upstream.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      return Response.json({ error: "Youverify sandbox source did not return an image." }, { status: 502 });
    }

    const image = await upstream.arrayBuffer();
    if (image.byteLength === 0 || image.byteLength > 5_000_000) {
      return Response.json({ error: "Youverify sandbox image is unavailable or too large." }, { status: 502 });
    }

    return new Response(image, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return Response.json({ error: "Unable to prepare Youverify sandbox image." }, { status: 500 });
  }
}
