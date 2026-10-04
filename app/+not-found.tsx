import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Página não encontrada" }} />

      <View style={styles.container}>
        <Text style={styles.title}>Página não encontrada</Text>

        <Text style={styles.text}>
          O endereço que você tentou abrir não existe no Orvena.
        </Text>

        <Link href="/(tabs)" style={styles.link}>
          VOLTAR PARA O INÍCIO
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0C10",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  text: {
    color: "#7D848F",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 360,
  },
  link: {
    marginTop: 20,
    color: "#BDB1FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});
