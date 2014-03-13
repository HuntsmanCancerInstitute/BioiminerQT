package hci.biominer.parser;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import hci.biominer.util.ColumnValidators;

public class ChipParserCommand {
	private int chromColumn = -1;
	private int startColumn = -1;
	private int endColumn = -1;
	private int fdrColumn = -1;
	private int logColumn = -1;
	private int colMax = -1;
	private File inputFile = null;
	private File outputFile = null;
	private String genomeBuild = null;
	private boolean isConverted = false;
	private ArrayList<String> parsedData = null;
	
	

	public ChipParserCommand(String[] args) {
		//Validate command line arguments
		System.out.println("Processing command line arguments:");
		this.processArgs(args);
		System.out.println("Finished processing command line arguments.\n");
	
		//Read through file
		System.out.println("Processing input file:");
		this.processData();
		System.out.println("Finished processing input file.\n");
		
		//Write output
		System.out.println("Writing output file:");
		this.writeData();
		System.out.println("Finished writing output file.\n");
		
		
		System.out.println("All done!\n");
	
	}

	public static void main(String[] args) {
		if (args.length == 0) {
			printDocs();
			System.exit(1);
		}
		
		new ChipParserCommand(args);
	}
	
	
	
	
	private static void printDocs(){
		System.out.println("\n" +
				"**************************************************************************************\n" +
				"**                                  ChipParserCommand                               **\n" +
				"**************************************************************************************\n" +
				"ChipParserCommand reads in ChIPSeq data from a tab-delimited text file.  The user \n" +
				"specifies the locations of necessary columns and the application reads in the data. \n" +
				"The application tries to identify errors as it's reading in the data.  If everything \n" +
				"looks kosher, the data is written out to a text file.\n\n" +
				
				"\nNotes:\n" +
				"1) This application assumes here is a header. If your input file does not have\n " +
				"a header the first line will be skipped.\n" +
				"2) This application checks the number of columns using the second line of the input\n" +
				"file.  The USeq header lines often contain a extra column with DAS2 information.\n" +
				"3) This application only handles 'standard' chromosomes.\n\n" +
				
				"\nRequired:\n" +
				"-i Input file.  Currently only supports reading tab-delimited files\n" +
				"-b Genome Build. Currently, the only build supported is hg19.\n" +
				"-o Output File.  Parsed output file.\n"+
				"-c Chromosome column index. (1-based)\n" +
				"-s Region start column index. (1-based)\n" +
				"-e Region end column index. (1-based)\n" +
				"-f FDR column index. (1-based)\n" +
				"-l Log2Ratio column index. (1-based)\n" +
				
				"\nOptional:\n" +
				"-a FDR is already converted to -10 * log10(FDR)\n" +
				
				"\n" +
				"Example: java -Xmx500M -jar path/to/ChipParserCommand -i 10594R.chip.txt -b hg19\n" +
				"      -o 10594R.parsedChip.txt -c 2 -s 3 -e 4 -f 10 -l 12\n" +
				

				"**************************************************************************************\n");
	}
	
	private void writeData() {
		BufferedWriter bw = null;
		try {
			//Open file handle
			bw = new BufferedWriter(new FileWriter(this.outputFile));
			
			//Write data
			for (String line: this.parsedData) {
				bw.write(line);
			}
			
			//Close handle
			bw.close();
		} catch (IOException ioex) {
			System.out.println(String.format("Error writing to output file file: %s.  Exiting\n",ioex.getMessage()));
			System.exit(1);
		} finally {
			try {
				bw.close();
			} catch (Exception e){}
		}
	}
	
	private void processData() {
		BufferedReader br = null;
		try {
			//Open file handle
			br = new BufferedReader(new FileReader(this.inputFile));
			
			//Slurp the header
			br.readLine();
			
			//Initialize input file variables
			this.parsedData = new ArrayList<String>();
			String line = null;
			boolean failed = false;
			int lineCount = 1;
			
			//Initialize warning variables
			boolean allTransformedFdrLessThanOne = true;
			if (!this.isConverted) {
				allTransformedFdrLessThanOne = false;
			}
			boolean allLog2RatioPos = true;
			boolean allLog2RatioNeg = true;
			
			while ((line = br.readLine()) != null) {
				String[] parts = line.split("\t");
				
				//Initialize line variables
				String tempChrom;
				int tempStart = -1;
				int tempEnd = -1;
				float tempFdr = -1;
				float tempLog = -1;
				
				//Make sure the line length matches header. Parsing might go OK if this fails, but I 
				//think it's best to error out when the file is at all malformed.
				if (parts.length != this.colMax) {
					System.out.println(String.format("The number of columns in row %d ( %d ) doesn't match the header ( %d )\n",
							lineCount,parts.length,this.colMax));
					failed = true;
					break;
				}
				
				//Parse chromsome, check to make sure it's recognizable
				if ((tempChrom = ColumnValidators.validateChromosome(this.genomeBuild, parts[this.chromColumn])) == null) {
					failed = true;
					break;
				}
				
				
				//Parse start position, make sure it's an integer and within boundaries
				if ((tempStart = ColumnValidators.validateCoordiate(this.genomeBuild, tempChrom, parts[this.startColumn])) == -1) {
					failed = true;
					break;
				}
				
				//Parse end position, make sure it's an integer and within boundaries
				if ((tempEnd = ColumnValidators.validateCoordiate(this.genomeBuild, tempChrom, parts[this.endColumn])) == -1) {
					failed = true;
					break;
				}
				
				//Check to sure end is greater than start
				if (tempEnd <= tempStart) {
					System.out.println(String.format("Region end %d is less than or equal to region start %d, exiting.",tempEnd,tempStart));
					failed = true;
				}
				
				//Parse FDR
				if ((tempFdr = ColumnValidators.validateFdr(parts[this.fdrColumn], this.isConverted)) == -1) {
					failed = true;
					break;
				} else {
					if (this.isConverted && tempFdr > 1) {
						allTransformedFdrLessThanOne = false;
					}
				}
				
				//Parse LogRatio
				if ((tempLog = ColumnValidators.validateLog2Ratio(parts[this.logColumn])) == Float.MAX_VALUE) {
					failed =  true;
					break;
				} else {
					if (tempLog > 0) {
						allLog2RatioNeg = false;
					} else if (tempLog < 0) {
						allLog2RatioPos = false;
					}
				}
				
				
				//Create output string and add to data list
				String outputFile = String.format("%s\t%d\t%d\t%f\t%f\n",tempChrom,tempStart,tempEnd,tempFdr,tempLog);
				this.parsedData.add(outputFile);
				
				lineCount++;
			}
			
			//Throw failure message or warning messages
			if (failed) {
				System.out.println("This application identified malformed lines, please fix errors and re-run the application.\n");
				System.exit(1);
			} else if (allTransformedFdrLessThanOne) {
				System.out.println("WARNING: FDR formatting style was set as transformed, but all values were between 0 and 1.  Are you sure the FDR values were transformed? "
						+ "FDR values are transformed using the formula -10 * log10(FDR)");				
			} else if (allLog2RatioNeg) {
				System.out.println("WARNING: All log2ratios were less than or equal to zero.  Are you sure the log2Ratios are formatted correctly?");
			} else if (allLog2RatioPos) {
				System.out.println("WARNING: All log2ratios were greater than or equal to zero.  Are you sure the log2Ratios are formatted correctly?");
			}
			
			
		} catch (IOException ioex) {
			System.out.println(String.format("Error processing data file: %s.  Exiting\n",ioex.getMessage()));
			System.exit(1);
		} finally {
			try {
				br.close();
			} catch (Exception e){}
		}
		
	}
	
	private void processArgs(String[] args){
		String tempBuild = null;
		
		Pattern pat = Pattern.compile("-[a-z]");
		for (int i = 0; i<args.length; i++){
			String lcArg = args[i].toLowerCase();
			Matcher mat = pat.matcher(lcArg);
			if (mat.matches()){
				char test = args[i].charAt(1);
				try{
					switch (test){
					
					case 'i': this.inputFile = new File(args[++i]); break;
					case 'b': tempBuild = args[++i]; break;
					case 'o': this.outputFile = new File(args[++i]); break;
					case 'c': this.chromColumn = Integer.parseInt(args[++i])-1; break;
					case 's': this.startColumn = Integer.parseInt(args[++i])-1; break;
					case 'e': this.endColumn = Integer.parseInt(args[++i])-1; break;
					case 'f': this.fdrColumn = Integer.parseInt(args[++i])-1; break;
					case 'l': this.logColumn = Integer.parseInt(args[++i])-1; break;
					case 'a': this.isConverted = true; break;
					
					case 'h': printDocs(); System.exit(0);
					default: System.out.println("\nProblem, unknown option! " + mat.group());
					}
				}
				catch (Exception e){
					System.out.print("\nSorry, something doesn't look right with this parameter request: -"+test);
					System.out.println();
					System.exit(0);
				}
			}
		}
		
		
		if (tempBuild == null) {
			System.out.println("The genome build wasn't specified, please re-run the app with the appropriate parameters\n");
			System.exit(1);
		}

		//Make sure the file are formed properly
		if (this.inputFile ==null){
			System.out.println("Input file ( -i ) not specified, please re-run the app with the appropriate parameters.\n");
			System.exit(1);
		}
		
		if (!this.inputFile.exists()) {
			System.out.println(String.format("Specified input file does not exist: %s\n",this.inputFile.getAbsolutePath()));
			System.exit(1);
		}
		
		if (this.outputFile == null) {
			System.out.println("Output file ( -o ) not specified, please re-run the app with the approprate paramaters.\n");
			System.exit(1);
		}
		
		//Check to make sure the genome build is present
		this.genomeBuild = ColumnValidators.checkBuildExistance(tempBuild);
		
		//Slurp header for number of columns:
		Integer[] colsToCheck = new Integer[]{this.chromColumn,this.startColumn,this.endColumn,this.fdrColumn,this.logColumn};
		String[] colNames = new String[] {"Chromsome Column","Start Column","End Column","FDR Column","Log Column"};
		colMax = ColumnValidators.validateColumns(colsToCheck, colNames, this.inputFile);
		
	}

}
