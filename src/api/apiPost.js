import Cookies from "universal-cookie";

export const apiPost = async ({ url, headers, body }) => {
  try {
    const abortController = new AbortController();
    const cookies = new Cookies();
    const csrfToken = cookies.get("csrf");

    const requestHeaders = {
      ...headers,
      "X-CSRF-TOKEN": csrfToken,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: requestHeaders,
      credentials: "include",
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData }; // Return error data
    } else {
      const data = await response.json();
      console.log(data);
      return { data }; // Return the successful data
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("API Post request aborted");
      return { aborted: true };
    } else {
      console.error("API Post error:", error);
      return { error: error.message }; // Return the error message
    }
  } finally {
    // No need for explicit abort cleanup here
  }
};
