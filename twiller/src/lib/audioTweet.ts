export const AUDIO_TWEET_MAX_DURATION_SECONDS = 300;
export const AUDIO_TWEET_MAX_SIZE_BYTES = 100 * 1024 * 1024;
export const AUDIO_TWEET_WINDOW_START_MINUTES = 14 * 60;
export const AUDIO_TWEET_WINDOW_END_MINUTES = 19 * 60;
export const AUDIO_TWEET_WINDOW_LABEL = "2:00 PM and 7:00 PM IST";

const getTimePartsInTimeZone = (date: Date, timeZone: string) => {
  const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dateTimeFormat.formatToParts(date);
  return parts.reduce<Record<string, string>>((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }

    return accumulator;
  }, {});
};

export const isAudioTweetWindowOpen = (date = new Date()) => {
  const parts = getTimePartsInTimeZone(date, "Asia/Kolkata");
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);

  return (
    currentMinutes >= AUDIO_TWEET_WINDOW_START_MINUTES &&
    currentMinutes <= AUDIO_TWEET_WINDOW_END_MINUTES
  );
};
