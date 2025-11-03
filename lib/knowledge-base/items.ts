import { createServiceClient } from "@/lib/supabase/server";

export interface CreateItemInput {
  knowledgeBaseId: string;
  organizationId: string | undefined;
  name: string;
  url?: string;
  text_content?: string;
  file?: File;
  type: "url" | "text" | "file" | "rightmove_agent";
  metadata?: Record<string, unknown>;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface CreateItemResult {
  itemData: Record<string, unknown>;
}

/**
 * Create item data for a knowledge base item (without processing)
 * Processing will be handled by background task
 */
export async function createKnowledgeBaseItem(
  input: CreateItemInput
): Promise<CreateItemResult> {
  const itemData: Record<string, unknown> = {
    knowledge_base_id: input.knowledgeBaseId,
    name: input.name,
    type: input.type,
    status: "pending", // Will be processed by background task
    chunk_size: input.chunkSize || 512,
    chunk_overlap: input.chunkOverlap || 50,
  };

  // Add metadata if provided
  if (input.metadata) {
    itemData.metadata = input.metadata;
  }

  if (input.type === "url" && input.url) {
    itemData.url = input.url;
  } else if (input.type === "text" && input.text_content) {
    itemData.text_content = input.text_content;
  } else if (input.type === "rightmove_agent") {
    // rightmove_agent type only needs metadata (which is already added above)
    // Processing will be handled by the background task
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
    }
  }

  return { itemData };
}

/**
 * Check if a URL already exists in a knowledge base
 */
export async function checkUrlExists(
  knowledgeBaseId: string,
  url: string
): Promise<boolean> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("knowledge_base_items")
    .select("id")
    .eq("knowledge_base_id", knowledgeBaseId)
    .eq("url", url)
    .eq("type", "url")
    .is("deleted_at", null)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "not found" error, which is fine
    console.error("Error checking URL existence:", error);
  }

  return !!data;
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

