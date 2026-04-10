import fetchClient from "../utils/fetchClient";

export const exchangeToken = async (microsoftIdToken: string) => {
  if (!microsoftIdToken) {
    throw new Error("Missing Microsoft id token for exchange");
  }

  try {
    const data = await fetchClient("/auth/ms/exchange", {
      headers: {
        Authorization: `Bearer ${microsoftIdToken}`,
      },
    });
    return data;
  } catch (error) {
    console.error("Token exchange error:", error);
    throw error;
  }
};

export const logoutFromBackend = async () => {
  try {
    await fetchClient("/auth/ms/logout");
  } catch (error) {
    console.error("Backend logout error:", error);
    throw error;
  }
};