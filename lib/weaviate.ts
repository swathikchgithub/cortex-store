const base = () => {
  const url = process.env.WEAVIATE_URL;
  if (!url) throw new Error("WEAVIATE_URL is not set");
  return url;
};

const headers = () => {
  const apiKey = process.env.WEAVIATE_API_KEY;
  if (!apiKey) throw new Error("WEAVIATE_API_KEY is not set");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };
};

export async function initSchema() {
  const existing = await fetch(`${base()}/v1/schema/Document`, { headers: headers() });
  if (existing.ok) return { status: "already_exists" };

  const res = await fetch(`${base()}/v1/schema`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      class: "Document",
      vectorizer: "none",
      vectorIndexConfig: {
        ef: 64,
        efConstruction: 128,
        maxConnections: 16,
      },
      properties: [
        { name: "title",   dataType: ["text"] },
        { name: "content", dataType: ["text"] },
        { name: "source",  dataType: ["text"] },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Schema creation failed: ${await res.text()}`);
  return res.json();
}

export async function addDocument(doc: {
  title: string;
  content: string;
  source?: string;
  vector: number[];
}) {
  const res = await fetch(`${base()}/v1/objects`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      class: "Document",
      properties: {
        title: doc.title,
        content: doc.content,
        source: doc.source ?? "",
      },
      vector: doc.vector,
    }),
  });

  if (!res.ok) throw new Error(`Add document failed: ${await res.text()}`);
  return res.json();
}

export async function batchAddDocuments(
  docs: Array<{
    title: string;
    content: string;
    source?: string;
    vector: number[];
  }>
) {
  const objects = docs.map((doc) => ({
    class: "Document",
    properties: {
      title: doc.title,
      content: doc.content,
      source: doc.source ?? "",
    },
    vector: doc.vector,
  }));

  const res = await fetch(`${base()}/v1/batch/objects`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ objects }),
  });

  if (!res.ok) throw new Error(`Batch add failed: ${await res.text()}`);
  return res.json();
}

export interface SearchResult {
  title: string;
  content: string;
  source: string;
  certainty: number;
  distance: number;
}

export async function searchDocuments(
  vector: number[],
  limit = 5,
  certaintyThreshold = 0.6
): Promise<SearchResult[]> {
  const query = `{
    Get {
      Document(
        nearVector: {
          vector: [${vector.join(",")}]
          certainty: ${certaintyThreshold}
        }
        limit: ${limit}
      ) {
        title
        content
        source
        _additional { certainty distance }
      }
    }
  }`;

  const res = await fetch(`${base()}/v1/graphql`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Search failed: ${await res.text()}`);
  const json = await res.json();

  if (json.errors) throw new Error(JSON.stringify(json.errors));

  const results = json.data?.Get?.Document ?? [];
  return results.map((r: any) => ({
    title: r.title,
    content: r.content,
    source: r.source,
    certainty: r._additional.certainty,
    distance: r._additional.distance,
  }));
}

export async function hybridSearch(
  query: string,
  vector: number[],
  limit = 5
) {
  const gql = `{
    Get {
      Document(
        hybrid: {
          query: "${query.replace(/"/g, '\\"')}"
          vector: [${vector.join(",")}]
          alpha: 0.5
        }
        limit: ${limit}
      ) {
        title
        content
        source
        _additional { score }
      }
    }
  }`;

  const res = await fetch(`${base()}/v1/graphql`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query: gql }),
  });

  if (!res.ok) throw new Error(`Hybrid search failed: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data?.Get?.Document ?? [];
}

export async function getDocumentCount(): Promise<number> {
  const query = `{ Aggregate { Document { meta { count } } } }`;
  const res = await fetch(`${base()}/v1/graphql`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Count failed: ${await res.text()}`);
  const json = await res.json();
  return json.data?.Aggregate?.Document?.[0]?.meta?.count ?? 0;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${base()}/v1/objects/Document/${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete failed: ${await res.text()}`);
  }
}

export async function getDocumentIds(): Promise<string[]> {
  const res = await fetch(
    `${base()}/v1/objects?class=Document&limit=1000&fields=id`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`List failed: ${await res.text()}`);
  const json = await res.json();
  return (json.objects ?? []).map((o: any) => o.id);
}
