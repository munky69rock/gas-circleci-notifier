class Notifier {
  static SLACK_URL = '__YOUR_SLACK_WEBHOOK_URL__';
  static GMAIL_QUERY = '__QUERY_TO_FILTER_CIRCLE_CI_RESULT_MAIL__';

  results: Array<Result> = [];
  oneMinuteAgo: Date;

  constructor() {
    this.oneMinuteAgo = this.calcOneMinuteAgo();
  }

  run() {
    this.fetchResults();        
    if (this.results.length === 0) {
      Logger.log('no results, skip');
      return;
    }
    Logger.log(`will send to slack: ${this.results.length}`);
    this.sendToSlack();
  }

  private calcOneMinuteAgo(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() - 1);
  }

  private isTarget(message: GoogleAppsScript.Gmail.GmailMessage): Boolean {
    const subject = message.getSubject();
    const time = message.getDate().getTime();
    return this.withinOneMinute(time) && this.hasNegativeWords(subject);
  }

  private withinOneMinute(time: number): Boolean {
    return time > this.oneMinuteAgo.getTime();
  }

  private hasNegativeWords(text: string): Boolean {
    return /(failed|no tests)/i.test(text);
  }

  private fetchResults() {
    const threads = GmailApp.search(Notifier.GMAIL_QUERY, 0, 10);
    const messages = threads.reduce((result, thread) => result.concat(thread.getMessages()), new Array<GoogleAppsScript.Gmail.GmailMessage>());
    messages.forEach(message => {
      if (this.isTarget(message)) {
        this.results.push({
          subject: message.getSubject(),
          body: message.getBody()
        });
      }
    });
  }

  private buildPayload(): string {
    let attachments: Array<Attachment> = [];
    this.results.forEach(result => {
      const color = this.getColorCode(result.subject);
      attachments.push({
        color: color,
        title: result.subject,
        text: result.body
      });
    });
    return JSON.stringify({
      attachments: attachments
    });
  }

  private getColorCode(subject: string): string {
    return /(failed|no tests)/i.test(subject) ? 'danger' : 'good';
  }

  private sendToSlack() {
    UrlFetchApp.fetch(Notifier.SLACK_URL, {
      method: 'post',
      payload: this.buildPayload()
    });
  }
}

interface Result {
  subject: string;
  body: string;
}

interface Attachment {
  color: string;
  title: string;
  text: string;
}

new Notifier().run();
