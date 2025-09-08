const nodemailer = require('nodemailer');
const twilio = require('twilio');
const logger = require('../utils/logger');
const config = require('../config/config');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.isEmailEnabled = false;
    this.twilioClient = null;
    this.isSmsEnabled = false;
    this.initialize();
  }

  async initialize() {
    try {
      const notificationConfig = config.settings.notifications;
      
      // Initialize Email
      if (notificationConfig.email && notificationConfig.smtp.user && notificationConfig.smtp.pass) {
        this.emailTransporter = nodemailer.createTransporter({
          host: notificationConfig.smtp.host,
          port: notificationConfig.smtp.port,
          secure: notificationConfig.smtp.port === 465,
          auth: {
            user: notificationConfig.smtp.user,
            pass: notificationConfig.smtp.pass
          }
        });

        // Verify email configuration
        await this.emailTransporter.verify();
        this.isEmailEnabled = true;
        logger.info('Email notifications initialized successfully');
      } else {
        logger.warn('Email configuration incomplete - email notifications disabled');
      }

      // Initialize SMS
      if (notificationConfig.sms && notificationConfig.sms.accountSid && notificationConfig.sms.authToken) {
        this.twilioClient = twilio(notificationConfig.sms.accountSid, notificationConfig.sms.authToken);
        this.isSmsEnabled = true;
        logger.info('SMS notifications initialized successfully');
      } else {
        logger.warn('SMS configuration incomplete - SMS notifications disabled');
      }
    } catch (error) {
      logger.error('Failed to initialize notifications:', error);
      this.isEmailEnabled = false;
      this.isSmsEnabled = false;
    }
  }

  async sendOrderSuccessNotification(productInfo, orderResult) {
    const subject = `Order Placed Successfully - ${productInfo.productName}`;
    const message = `
      <h2>Health Product Order Confirmation</h2>
      <p>An order has been successfully placed for the following product:</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>${productInfo.productName}</h3>
        <p><strong>Price:</strong> ${productInfo.price}</p>
        <p><strong>URL:</strong> <a href="${productInfo.url}">${productInfo.url}</a></p>
        <p><strong>Order ID:</strong> ${orderResult.orderId || 'N/A'}</p>
        <p><strong>Timestamp:</strong> ${new Date(productInfo.timestamp).toLocaleString()}</p>
      </div>
      
      <p><strong>Order Details:</strong></p>
      <ul>
        <li>Quantity: ${config.getOrderConfig().quantityPerOrder || 1}</li>
        <li>Max Amount: $${config.getOrderConfig().maxOrderAmount}</li>
        <li>Auto Checkout: ${config.getOrderConfig().autoCheckout ? 'Enabled' : 'Disabled'}</li>
      </ul>
      
      <hr style="margin: 20px 0;">
      <p><small>This is an automated notification from Health Product Automator</small></p>
    `;

    await this.sendNotification(subject, message, 'order-success');
  }

  async sendStockAlertNotification(productInfo) {
    const subject = `Stock Alert - ${productInfo.productName} is now available!`;
    const message = `
      <h2>Product Stock Alert</h2>
      <p>Great news! The following product is now in stock:</p>
      
      <div style="background: #f0f8f0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <h3>${productInfo.productName}</h3>
        <p><strong>Price:</strong> ${productInfo.price}</p>
        <p><strong>Stock Status:</strong> ${productInfo.stockStatus}</p>
        <p><strong>URL:</strong> <a href="${productInfo.url}">View Product</a></p>
        <p><strong>Detected:</strong> ${new Date(productInfo.timestamp).toLocaleString()}</p>
      </div>
      
      <p><strong>Automation Status:</strong></p>
      <ul>
        <li>Auto Order: ${config.getOrderConfig().autoOrderEnabled ? 'Enabled' : 'Disabled'}</li>
        <li>Daily Order Limit: ${config.getOrderConfig().maxDailyOrders}</li>
        <li>Max Price Threshold: $${config.getOrderConfig().maxOrderAmount}</li>
      </ul>
      
      <hr style="margin: 20px 0;">
      <p><small>This is an automated notification from Health Product Automator</small></p>
    `;

    await this.sendNotification(subject, message, 'stock-alert');
  }

  async sendErrorNotification(error, context = '') {
    const subject = `Health Product Automator - Error Alert`;
    const message = `
      <h2>System Error Alert</h2>
      <p>An error has occurred in the Health Product Automator:</p>
      
      <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
        <h3>Error Details</h3>
        <p><strong>Context:</strong> ${context}</p>
        <p><strong>Error Message:</strong> ${error.message}</p>
        <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        ${error.stack ? `<p><strong>Stack Trace:</strong><br><pre style="font-size: 12px;">${error.stack}</pre></p>` : ''}
      </div>
      
      <p>Please check the application logs for more detailed information.</p>
      
      <hr style="margin: 20px 0;">
      <p><small>This is an automated notification from Health Product Automator</small></p>
    `;

    await this.sendNotification(subject, message, 'error-alert');
  }

  async sendDailyReport(stats, products) {
    const subject = `Daily Report - Health Product Automator`;
    const inStockProducts = products.filter(p => p.isInStock);
    const outOfStockProducts = products.filter(p => !p.isInStock);
    
    const message = `
      <h2>Daily Monitoring Report</h2>
      <p>Here's your daily summary for ${new Date().toDateString()}:</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Statistics</h3>
        <ul>
          <li><strong>Total Checks:</strong> ${stats.totalChecks}</li>
          <li><strong>Successful Orders:</strong> ${stats.successfulOrders}</li>
          <li><strong>Products Monitored:</strong> ${stats.productsTracked}</li>
          <li><strong>Errors:</strong> ${stats.errors}</li>
        </ul>
      </div>
      
      ${inStockProducts.length > 0 ? `
        <div style="background: #f0f8f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Products In Stock (${inStockProducts.length})</h3>
          <ul>
            ${inStockProducts.map(p => `<li>${p.productName} - ${p.price}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${outOfStockProducts.length > 0 ? `
        <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Products Out of Stock (${outOfStockProducts.length})</h3>
          <ul>
            ${outOfStockProducts.map(p => `<li>${p.productName}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <hr style="margin: 20px 0;">
      <p><small>This is an automated daily report from Health Product Automator</small></p>
    `;

    await this.sendNotification(subject, message, 'daily-report');
  }

  async sendNotification(subject, htmlMessage, type = 'general') {
    const notifications = [];

    // Send Email Notification
    if (this.isEmailEnabled) {
      try {
        const emailResult = await this.sendEmail(subject, htmlMessage);
        notifications.push({ type: 'email', success: true, result: emailResult });
        logger.info(`Email notification sent: ${subject}`);
      } catch (error) {
        notifications.push({ type: 'email', success: false, error: error.message });
        logger.error(`Failed to send email notification: ${error.message}`);
      }
    }

    // Send SMS Notification ONLY for stock alerts and order success
    if (this.isSmsEnabled && (type === 'stock-alert' || type === 'order-success')) {
      try {
        const smsMessage = this.htmlToText(htmlMessage);
        const smsResult = await this.sendSMS(subject, smsMessage);
        notifications.push({ type: 'sms', success: true, result: smsResult });
        logger.info(`SMS notification sent: ${subject}`);
      } catch (error) {
        notifications.push({ type: 'sms', success: false, error: error.message });
        logger.error(`Failed to send SMS notification: ${error.message}`);
      }
    }

    // Log notification for debugging
    logger.info(`Notification sent - Type: ${type}, Subject: ${subject}`);

    return notifications;
  }

  async sendEmail(subject, htmlContent) {
    if (!this.isEmailEnabled) {
      throw new Error('Email notifications not configured');
    }

    const notificationConfig = config.settings.notifications;
    const mailOptions = {
      from: `"Health Product Automator" <${notificationConfig.smtp.user}>`,
      to: notificationConfig.email,
      subject: subject,
      html: htmlContent
    };

    const result = await this.emailTransporter.sendMail(mailOptions);
    return result;
  }

  async sendSMS(subject, textMessage) {
    if (!this.isSmsEnabled) {
      throw new Error('SMS notifications not configured');
    }

    const notificationConfig = config.settings.notifications;
    const smsBody = `${subject}\n\n${textMessage}`;
    
    // Truncate SMS to 1600 characters (Twilio limit)
    const truncatedBody = smsBody.length > 1600 ? smsBody.substring(0, 1597) + '...' : smsBody;

    const result = await this.twilioClient.messages.create({
      body: truncatedBody,
      from: notificationConfig.sms.fromNumber,
      to: notificationConfig.sms.toNumber
    });

    return result;
  }

  htmlToText(html) {
    // Simple HTML to text conversion for SMS
    return html
      .replace(/<h[1-6]>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<p>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  async testNotification() {
    const testMessage = `
      <h2>Test Notification</h2>
      <p>This is a test notification to verify that the notification system is working correctly.</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      <p>If you receive this email, your notification system is configured properly.</p>
    `;

    const results = await this.sendNotification(
      'Test Notification - Health Product Automator', 
      testMessage, 
      'test'
    );

    return results;
  }

  isEnabled() {
    return this.isEmailEnabled || this.isSmsEnabled;
  }

  getStatus() {
    return {
      email: {
        enabled: this.isEmailEnabled,
        configured: !!config.settings.notifications.smtp.user
      },
      sms: {
        enabled: this.isSmsEnabled,
        configured: !!config.settings.notifications.sms?.accountSid
      }
    };
  }
}

const notificationService = new NotificationService();
module.exports = notificationService;