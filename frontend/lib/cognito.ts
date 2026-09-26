import { CognitoUserPool } from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: "us-east-2_kFlJZW7ar",
  ClientId: "7d6ucjtp7k0g3rt6dk42kmhajt",
};

const userPool = new CognitoUserPool(poolData);

export default userPool;

export const COGNITO_REGION = "us-east-2";
