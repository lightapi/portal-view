import fetchClient from "../utils/fetchClient";

export const apiPost = async ({ url, headers, body }: { url: string; headers: Record<string, string>; body: any }) => {
  try {
    const data = await fetchClient(url, {
      method: "POST",
      body,
      headers,
    });
    return { data };
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log("API Post request aborted");
      return { aborted: true };
    } else {
      console.error("API Post error:", error);
      return { error };
    }
  }
};
