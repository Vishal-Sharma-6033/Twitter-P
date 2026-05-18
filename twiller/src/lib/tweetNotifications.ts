export const keywordPattern = /\b(cricket|science)\b/i;

export interface KeywordTweet {
  _id?: string;
  content?: string;
  author?: {
    displayName?: string;
    avatar?: string;
  };
}

export const containsKeywordTweet = (content?: string) =>
  Boolean(content && keywordPattern.test(content));

export const supportsBrowserNotifications = () =>
  typeof window !== "undefined" && "Notification" in window;

export const requestBrowserNotificationPermission = async () => {
  if (!supportsBrowserNotifications()) {
    return "unsupported" as const;
  }

  if (Notification.permission === "granted") {
    return "granted" as const;
  }

  if (Notification.permission === "denied") {
    return "denied" as const;
  }

  const permission = await Notification.requestPermission();
  return permission;
};

export const notifyAboutKeywordTweet = (tweet: KeywordTweet) => {
  if (!supportsBrowserNotifications() || Notification.permission !== "granted") {
    return false;
  }

  new Notification(tweet.author?.displayName || "Keyword tweet detected", {
    body: tweet.content || "",
    icon: tweet.author?.avatar,
    tag: tweet._id,
    silent: false,
  });

  return true;
};