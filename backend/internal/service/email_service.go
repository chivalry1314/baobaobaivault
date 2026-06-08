package service

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html"
	"net"
	"net/smtp"
	"strings"

	"github.com/baobaobai/baobaobaivault/internal/config"
)

type EmailService struct {
	cfg config.EmailConfig
}

func NewEmailService(cfg config.EmailConfig) *EmailService {
	return &EmailService{cfg: cfg}
}

func (s *EmailService) Enabled() bool {
	return s != nil && s.cfg.Enabled
}

func (s *EmailService) HealthView(emailVerificationEnabled bool) ShareEmailHealthView {
	if s == nil {
		return ShareEmailHealthView{
			Enabled:                  false,
			EmailVerificationEnabled: emailVerificationEnabled,
		}
	}
	return ShareEmailHealthView{
		Enabled:                  s.Enabled(),
		EmailVerificationEnabled: emailVerificationEnabled,
		FromAddress:              strings.TrimSpace(s.cfg.FromAddress),
		SMTPHost:                 strings.TrimSpace(s.cfg.SMTPHost),
		SMTPPort:                 s.cfg.SMTPPort,
	}
}

func (s *EmailService) SendVerificationCode(email, code string, ttlMinutes int) error {
	if !s.Enabled() {
		return fmt.Errorf("email service is disabled")
	}

	subject := "CardShare 注册验证码"
	plainBody, htmlBody := buildVerificationEmailBody(s.safeFromName(), email, code, ttlMinutes)
	return s.sendEmail(email, subject, plainBody, htmlBody)
}

func (s *EmailService) SendTestEmail(toAddress string) error {
	if !s.Enabled() {
		return fmt.Errorf("email service is disabled")
	}

	toAddress = strings.TrimSpace(toAddress)
	subject := "CardShare SMTP 测试邮件"
	plainBody, htmlBody := buildSMTPTestEmailBody(s.safeFromName(), toAddress)
	return s.sendEmail(toAddress, subject, plainBody, htmlBody)
}

func (s *EmailService) sendEmail(toAddress, subject, plainBody, htmlBody string) error {
	host := strings.TrimSpace(s.cfg.SMTPHost)
	port := s.cfg.SMTPPort
	username := strings.TrimSpace(s.cfg.SMTPUsername)
	password := s.cfg.SMTPPassword
	fromAddress := strings.TrimSpace(s.cfg.FromAddress)
	fromName := s.safeFromName()
	toAddress = strings.TrimSpace(toAddress)

	var message bytes.Buffer
	message.WriteString(fmt.Sprintf("From: %s <%s>\r\n", fromName, fromAddress))
	message.WriteString(fmt.Sprintf("To: %s\r\n", toAddress))
	message.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	message.WriteString("MIME-Version: 1.0\r\n")
	message.WriteString("Content-Type: multipart/alternative; boundary=\"cardshare-boundary\"\r\n")
	message.WriteString("\r\n")
	message.WriteString("--cardshare-boundary\r\n")
	message.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	message.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	message.WriteString("\r\n")
	message.WriteString(plainBody)
	message.WriteString("\r\n")
	message.WriteString("--cardshare-boundary\r\n")
	message.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	message.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	message.WriteString("\r\n")
	message.WriteString(htmlBody)
	message.WriteString("\r\n")
	message.WriteString("--cardshare-boundary--\r\n")

	if port == 465 {
		return s.sendUsingTLS(host, port, username, password, fromAddress, toAddress, message.Bytes())
	}

	return s.sendUsingSTARTTLS(host, port, username, password, fromAddress, toAddress, message.Bytes())
}

func (s *EmailService) safeFromName() string {
	fromName := strings.TrimSpace(s.cfg.FromName)
	if fromName == "" {
		return "CardShare"
	}
	return fromName
}

func buildVerificationEmailBody(fromName, email, code string, ttlMinutes int) (string, string) {
	safeFromName := html.EscapeString(strings.TrimSpace(fromName))
	safeEmail := html.EscapeString(strings.TrimSpace(email))
	safeCode := html.EscapeString(strings.TrimSpace(code))

	plainBody := fmt.Sprintf(
		"您好，\r\n\r\n您正在注册 %s。\r\n\r\n本次验证码：%s\r\n有效时间：%d 分钟\r\n注册邮箱：%s\r\n\r\n如果这不是您的操作，请忽略这封邮件。\r\n",
		fromName,
		code,
		ttlMinutes,
		email,
	)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f4f8fb;font-family:'Microsoft YaHei',sans-serif;color:#1f2937;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:linear-gradient(135deg,#ffffff 0%%,#eef7ff 100%%);border:1px solid #dbe7f3;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(31,41,55,0.08);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#d9eefb 0%%,#f9fdfd 55%%,#fdeef6 100%%);border-bottom:1px solid rgba(148,163,184,0.18);">
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#ffffff;border:1px solid #cfe0ef;font-size:12px;font-weight:700;color:#4b5563;">CardShare 安全验证</div>
          <h1 style="margin:18px 0 8px;font-size:28px;line-height:1.2;color:#0f172a;">邮箱验证码</h1>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">您正在为 <strong>%s</strong> 完成注册验证，请在有效期内使用下面的验证码。</p>
        </div>
        <div style="padding:32px;">
          <div style="margin-bottom:22px;padding:22px;border-radius:24px;background:#ffffff;border:1px solid #d7e4ef;text-align:center;">
            <div style="font-size:13px;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;">Verification Code</div>
            <div style="margin-top:14px;font-size:40px;line-height:1;font-weight:800;letter-spacing:0.22em;color:#0f172a;">%s</div>
          </div>
          <div style="margin-bottom:18px;padding:18px 20px;border-radius:20px;background:#f8fbfe;border:1px solid #e2eaf2;">
            <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#334155;"><strong>有效时间：</strong>%d 分钟</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;"><strong>验证邮箱：</strong>%s</p>
          </div>
          <p style="margin:0;font-size:14px;line-height:1.8;color:#64748b;">如果这不是您的操作，请直接忽略这封邮件。为了保护账号安全，请不要将验证码透露给任何人。</p>
        </div>
        <div style="padding:18px 32px 28px;font-size:12px;line-height:1.8;color:#94a3b8;">
          <div>%s</div>
          <div>这是一封系统自动发送的邮件，请勿直接回复。</div>
        </div>
      </div>
    </div>
  </body>
</html>`, safeFromName, safeCode, ttlMinutes, safeEmail, safeFromName)

	return plainBody, htmlBody
}

func buildSMTPTestEmailBody(fromName, email string) (string, string) {
	safeFromName := html.EscapeString(strings.TrimSpace(fromName))
	safeEmail := html.EscapeString(strings.TrimSpace(email))

	plainBody := fmt.Sprintf(
		"您好，\r\n\r\n这是一封来自 %s 的 SMTP 测试邮件。\r\n\r\n如果您收到这封邮件，说明当前后端的发信配置已经可以正常投递到：%s\r\n",
		fromName,
		email,
	)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f4f8fb;font-family:'Microsoft YaHei',sans-serif;color:#1f2937;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #dbe7f3;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(31,41,55,0.08);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#dff4ea 0%%,#f9fdfd 50%%,#eef7ff 100%%);border-bottom:1px solid rgba(148,163,184,0.18);">
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#ffffff;border:1px solid #cfe0ef;font-size:12px;font-weight:700;color:#4b5563;">CardShare SMTP Test</div>
          <h1 style="margin:18px 0 8px;font-size:28px;line-height:1.2;color:#0f172a;">测试邮件发送成功</h1>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">这是一封来自 <strong>%s</strong> 的 SMTP 测试邮件，用于确认当前后端发信配置工作正常。</p>
        </div>
        <div style="padding:32px;">
          <div style="padding:18px 20px;border-radius:20px;background:#f8fbfe;border:1px solid #e2eaf2;">
            <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#334155;"><strong>测试目标邮箱：</strong>%s</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;"><strong>结果：</strong>如果您收到这封邮件，说明 SMTP 主机、端口、账号与授权信息均已基本可用。</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`, safeFromName, safeEmail)

	return plainBody, htmlBody
}

func (s *EmailService) sendUsingTLS(host string, port int, username, password, fromAddress, toAddress string, message []byte) error {
	address := fmt.Sprintf("%s:%d", host, port)
	conn, err := tls.Dial("tcp", address, &tls.Config{ServerName: host})
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer client.Close()

	if err := authenticateSMTPClient(client, host, username, password); err != nil {
		return err
	}

	return writeSMTPMessage(client, fromAddress, toAddress, message)
}

func (s *EmailService) sendUsingSTARTTLS(host string, port int, username, password, fromAddress, toAddress string, message []byte) error {
	address := fmt.Sprintf("%s:%d", host, port)
	client, err := smtp.Dial(address)
	if err != nil {
		return err
	}
	defer client.Close()

	if err := client.Hello("localhost"); err != nil {
		return err
	}

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: host}); err != nil {
			return err
		}
	}

	if err := authenticateSMTPClient(client, host, username, password); err != nil {
		return err
	}

	return writeSMTPMessage(client, fromAddress, toAddress, message)
}

func authenticateSMTPClient(client *smtp.Client, host, username, password string) error {
	if client == nil || strings.TrimSpace(username) == "" {
		return nil
	}

	if ok, _ := client.Extension("AUTH"); !ok {
		return fmt.Errorf("smtp server does not support AUTH")
	}

	auth := smtp.PlainAuth("", username, password, host)
	return client.Auth(auth)
}

func writeSMTPMessage(client *smtp.Client, fromAddress, toAddress string, message []byte) error {
	if err := client.Mail(strings.TrimSpace(fromAddress)); err != nil {
		return err
	}
	if err := client.Rcpt(strings.TrimSpace(toAddress)); err != nil {
		return err
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(message); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	if err := client.Quit(); err != nil && !isSMTPConnectionClosed(err) {
		return err
	}
	return nil
}

func isSMTPConnectionClosed(err error) bool {
	if err == nil {
		return false
	}
	if netErr, ok := err.(*net.OpError); ok && netErr.Err != nil {
		return strings.Contains(strings.ToLower(netErr.Err.Error()), "closed")
	}
	return strings.Contains(strings.ToLower(err.Error()), "closed")
}
