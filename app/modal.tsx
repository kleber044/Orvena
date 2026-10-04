import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ModalScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ORVENA</Text>
          <Text style={styles.title}>Tela auxiliar</Text>
          <Text style={styles.text}>
            Esta rota não é usada pelos módulos principais do Orvena.
          </Text>

          <Pressable
            style={styles.button}
            onPress={() => router.replace("/(tabs)" as any)}
          >
            <Text style={styles.buttonText}>VOLTAR PARA O INÍCIO</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0C10",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2B3039",
    backgroundColor: "#12151B",
    padding: 22,
    alignItems: "center",
  },
  eyebrow: {
    color: "#7C5CFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
  },
  text: {
    color: "#7D848F",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 8,
  },
  button: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#7C5CFF",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});
