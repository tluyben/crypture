import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface VerificationEmailProps {
  userEmail: string;
  verificationUrl: string;
  userName?: string;
}

export const VerificationEmail = ({
  userEmail,
  verificationUrl,
  userName,
}: VerificationEmailProps) => (
  <Html>
    <Head />
    <Preview>Verify your Crypture account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logo}>🔐 Crypture</Text>
        </Section>
        
        <Heading style={heading}>Verify your email address</Heading>
        
        <Text style={paragraph}>
          Hi {userName || 'there'},
        </Text>
        
        <Text style={paragraph}>
          Welcome to Crypture! Please verify your email address to complete your account setup and start managing your secrets securely.
        </Text>
        
        <Section style={buttonContainer}>
          <Button style={button} href={verificationUrl}>
            Verify Email Address
          </Button>
        </Section>
        
        <Text style={paragraph}>
          Or copy and paste this URL into your browser:
        </Text>
        
        <Text style={link}>
          <Link href={verificationUrl} style={linkStyle}>
            {verificationUrl}
          </Link>
        </Text>
        
        <Text style={paragraph}>
          This verification link will expire in 24 hours. If you didn't create an account with Crypture, you can safely ignore this email.
        </Text>
        
        <Text style={footer}>
          Best regards,<br />
          The Crypture Team
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const logoSection = {
  padding: '32px 0',
  textAlign: 'center' as const,
};

const logo = {
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0 auto',
  textAlign: 'center' as const,
};

const heading = {
  fontSize: '24px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#484848',
  padding: '17px 30px 0',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#484848',
  padding: '0 30px',
};

const buttonContainer = {
  padding: '27px 30px 27px',
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px',
};

const link = {
  fontSize: '14px',
  color: '#b4becc',
  padding: '0 30px',
  wordBreak: 'break-all' as const,
};

const linkStyle = {
  color: '#5469d4',
  textDecoration: 'underline',
};

const footer = {
  fontSize: '14px',
  color: '#b4becc',
  padding: '0 30px',
  marginTop: '32px',
};

export default VerificationEmail;