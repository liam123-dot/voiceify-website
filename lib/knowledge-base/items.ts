import ragie from "@/lib/ragie/client";
import { createServiceClient } from "@/lib/supabase/server";

export interface CreateItemInput {
  knowledgeBaseId: string;
  organizationId: string | undefined;
  name: string;
  url?: string;
  text_content?: string;
  file?: File;
  type: "url" | "text" | "file";
}

export interface CreateItemResult {
  itemData: Record<string, unknown>;
  ragieDocumentId: string | null;
}

/**
 * Index a URL with Ragie
 */
export async function indexUrlWithRagie(
  url: string,
  name: string,
  knowledgeBaseId: string,
  organizationId: string | undefined
): Promise<{ documentId: string | null; error?: string }> {
  try {
    if (!organizationId) {
      return { documentId: null, error: "Organization ID is required" };
    }

    const metadata: Record<string, string> = {};
    if (name) metadata.name = name;
    if (knowledgeBaseId) metadata.knowledge_base_id = knowledgeBaseId;

    const ragieResponse = await ragie.documents.createDocumentFromUrl({
      url,
      partition: organizationId,
      metadata,
    });

    if (ragieResponse.id) {
      return { documentId: ragieResponse.id };
    }

    return { documentId: null, error: "No document ID returned from Ragie" };
  } catch (error) {
    console.error("Error indexing URL with Ragie:", error);
    return {
      documentId: null,
      error:
        error instanceof Error ? error.message : "Failed to index with Ragie",
    };
  }
}

/**
 * Index text content with Ragie
 */
export async function indexTextWithRagie(
  textContent: string,
  name: string,
  knowledgeBaseId: string,
  organizationId: string | undefined
): Promise<{ documentId: string | null; error?: string }> {
  try {
    if (!organizationId) {
      return { documentId: null, error: "Organization ID is required" };
    }

    const metadata: Record<string, string> = {};
    if (name) metadata.name = name;
    if (knowledgeBaseId) metadata.knowledge_base_id = knowledgeBaseId;

    const ragieResponse = await ragie.documents.createRaw({
      data: textContent,
      partition: organizationId,
      metadata,
    });

    if (ragieResponse.id) {
      return { documentId: ragieResponse.id };
    }

    return { documentId: null, error: "No document ID returned from Ragie" };
  } catch (error) {
    console.error("Error indexing text with Ragie:", error);
    return {
      documentId: null,
      error:
        error instanceof Error ? error.message : "Failed to index with Ragie",
    };
  }
}

/**
 * Index a file with Ragie
 */
export async function indexFileWithRagie(
  file: File,
  name: string,
  knowledgeBaseId: string,
  organizationId: string | undefined
): Promise<{ documentId: string | null; error?: string }> {
  try {
    if (!organizationId) {
      return { documentId: null, error: "Organization ID is required" };
    }

    const metadata: Record<string, string> = {};
    if (name) metadata.name = name;
    if (knowledgeBaseId) metadata.knowledge_base_id = knowledgeBaseId;
    if (file.type) metadata.file_type = file.type;

    const ragieResponse = await ragie.documents.create({
      file: file,
      partition: organizationId,
      metadata,
      mode: "fast",
    });

    if (ragieResponse.id) {
      return { documentId: ragieResponse.id };
    }

    return { documentId: null, error: "No document ID returned from Ragie" };
  } catch (error) {
    console.error("Error indexing file with Ragie:", error);
    return {
      documentId: null,
      error:
        error instanceof Error ? error.message : "Failed to index with Ragie",
    };
  }
}

/**
 * Create item data and index with Ragie based on type
 */
export async function createKnowledgeBaseItem(
  input: CreateItemInput
): Promise<CreateItemResult> {
  const itemData: Record<string, unknown> = {
    knowledge_base_id: input.knowledgeBaseId,
    name: input.name,
    type: input.type,
    status: "processing",
  };

  let ragieDocumentId: string | null = null;

  if (input.type === "url" && input.url) {
    itemData.url = input.url;

    const result = await indexUrlWithRagie(
      input.url,
      input.name,
      input.knowledgeBaseId,
      input.organizationId
    );

    if (result.documentId) {
      ragieDocumentId = result.documentId;
      itemData.ragie_document_id = ragieDocumentId;
    } else {
      itemData.status = "failed";
      itemData.sync_error = result.error || "Failed to index with Ragie";
    }
  } else if (input.type === "text" && input.text_content) {
    itemData.text_content = input.text_content;

    const result = await indexTextWithRagie(
      input.text_content,
      input.name,
      input.knowledgeBaseId,
      input.organizationId
    );

    if (result.documentId) {
      ragieDocumentId = result.documentId;
      itemData.ragie_document_id = ragieDocumentId;
    } else {
      itemData.status = "failed";
      itemData.sync_error = result.error || "Failed to index with Ragie";
    }
  } else if (input.type === "file" && input.file) {
    const file = input.file;

    // Generate file path
    const fileExtension = file.name.split(".").pop();
    const fileId = crypto.randomUUID();
    const filePath = `${input.organizationId}/${input.knowledgeBaseId}/${fileId}.${fileExtension}`;

    // Upload to Supabase Storage
    const supabase = await createServiceClient();
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("knowledge-base-files")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file to Supabase:", uploadError);
      itemData.status = "failed";
      itemData.sync_error = "Failed to upload file";
    } else {
      itemData.file_location = filePath;
      itemData.file_type = file.type;
      itemData.file_size = file.size;

      const result = await indexFileWithRagie(
        file,
        input.name,
        input.knowledgeBaseId,
        input.organizationId
      );

      if (result.documentId) {
        ragieDocumentId = result.documentId;
        itemData.ragie_document_id = ragieDocumentId;
      } else {
        itemData.status = "failed";
        itemData.sync_error = result.error || "Failed to index with Ragie";
      }
    }
  }

  return { itemData, ragieDocumentId };
}

/**
 * Insert a knowledge base item into the database
 */
export async function insertKnowledgeBaseItem(
  itemData: Record<string, unknown>
) {
  const supabase = await createServiceClient();

  const { data: item, error: insertError } = await supabase
    .from("knowledge_base_items")
    .insert(itemData)
    .select("*")
    .single();

  if (insertError) {
    console.error("Error creating knowledge base item:", insertError);
    throw new Error(insertError.message || "Failed to create item");
  }

  return item;
}

