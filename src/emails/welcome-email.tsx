import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  userEmail: string;
  userName?: string;
  dashboardUrl: string;
}

export const WelcomeEmail = ({
  userEmail,
  userName,
  dashboardUrl,
}: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Crypture - Your secure secrets management platform</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logo}>🔐 Crypture</Text>
        </Section>
        
        <Heading style={heading}>Welcome to Crypture!</Heading>
        
        <Text style={paragraph}>
          Hi {userName || 'there'},
        </Text>
        
        <Text style={paragraph}>
          Welcome to Crypture! Your account has been successfully set up and you're ready to start managing your secrets securely.
        </Text>
        
        <Section style={featureSection}>
          <Text style={featureHeading}>What you can do with Crypture:</Text>
          <Text style={featureItem}>🛡️ Store environment variables and secrets securely</Text>
          <Text style={featureItem}>⚡ Organize secrets by projects and environments</Text>
          <Text style={featureItem}>📦 Import/export secrets in multiple formats (.env, JSON, YAML, CSV)</Text>
          <Text style={featureItem}>🔄 Fork and copy configurations between environments</Text>
          <Text style={featureItem}>🔍 Track changes with comprehensive audit logging</Text>
        </Section>
        
        <Section style={buttonContainer}>
          <Button style={button} href={dashboardUrl}>
            Go to Dashboard
          </Button>
        </Section>
        
        <Text style={paragraph}>
          If you have any questions or need help getting started, feel free to reach out to our support team.
        </Text>
        
        <Text style={footer}>
          Happy secret managing!<br />
          The Crypture Team
        </Text>
        
        <Section style={footerSection}>
          <Text style={footerText}>
            You're receiving this email because you created an account with Crypture using {userEmail}.
          </Text>
        </Section>
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

const featureSection = {
  padding: '20px 30px',
  backgroundColor: '#f8fafc',
  margin: '20px 30px',
  borderRadius: '8px',
};

const featureHeading = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#484848',
  margin: '0 0 12px 0',
};

const featureItem = {
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#64748b',
  margin: '6px 0',
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

const footer = {
  fontSize: '16px',
  color: '#484848',
  padding: '0 30px',
  marginTop: '32px',
};

const footerSection = {
  padding: '20px 30px',
  borderTop: '1px solid #e2e8f0',
  marginTop: '32px',
};

const footerText = {
  fontSize: '12px',
  color: '#b4becc',
  lineHeight: '1.4',
};

export default WelcomeEmail;